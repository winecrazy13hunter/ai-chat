#!/usr/bin/env node
// scripts/gcp.js — Load .env.gcp and run gcloud commands with PROJECT_ID substitution
'use strict';

const { readFileSync, existsSync, writeFileSync, unlinkSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const envFile = path.join(process.cwd(), '.env.gcp');
const fileEnv = {};

if (existsSync(envFile)) {
  readFileSync(envFile, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq > 0) fileEnv[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    });
}

const env = { ...process.env, ...fileEnv };
const P = env.PROJECT_ID ?? '';
const REGION = 'asia-northeast1';
const APP = 'guitar-tab-bot';
const IMAGE = `${REGION}-docker.pkg.dev/${P}/${APP}/app`;
const SECRET = 'ANTHROPIC_API_KEY';

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', env, shell: true });
}

function runIgnoreExists(cmd) {
  console.log(`\n> ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit', env, shell: true });
  } catch {
    console.log('  (既に存在するためスキップ)\n');
  }
}

function setupGithubActions() {
  const owner = env.GITHUB_OWNER ?? '';
  const repo  = env.GITHUB_REPO  ?? '';

  if (!owner || !repo) {
    console.error(
      'Error: .env.gcp に GITHUB_OWNER と GITHUB_REPO を設定してください。\n' +
      '  GITHUB_OWNER=your-github-username\n' +
      '  GITHUB_REPO=your-repo-name',
    );
    process.exit(1);
  }

  // プロジェクト番号を取得
  const projectNumber = execSync(
    `gcloud projects describe ${P} --format=value(projectNumber)`,
    { env, encoding: 'utf8', shell: true },
  ).trim();

  const SA_NAME     = 'github-actions-sa';
  const SA_EMAIL    = `${SA_NAME}@${P}.iam.gserviceaccount.com`;
  const POOL        = 'github-actions';
  const PROVIDER    = 'github-provider';
  const computeSA   = `${projectNumber}-compute@developer.gserviceaccount.com`;
  const poolResource = `projects/${projectNumber}/locations/global/workloadIdentityPools/${POOL}`;

  // 1. Workload Identity Pool を作成
  runIgnoreExists(
    `gcloud iam workload-identity-pools create "${POOL}"` +
    ` --project="${P}" --location="global"` +
    ` --display-name="GitHub Actions"`,
  );

  // 2. OIDC プロバイダーを作成
  runIgnoreExists(
    `gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}"` +
    ` --project="${P}" --location="global"` +
    ` --workload-identity-pool="${POOL}"` +
    ` --display-name="GitHub Provider"` +
    ` --issuer-uri="https://token.actions.githubusercontent.com"` +
    ` --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"` +
    ` --attribute-condition="assertion.repository=='${owner}/${repo}'"`,
  );

  // 3. サービスアカウントを作成
  runIgnoreExists(
    `gcloud iam service-accounts create "${SA_NAME}"` +
    ` --project="${P}"` +
    ` --display-name="GitHub Actions Service Account"`,
  );

  // 4. プロジェクトレベルの IAM ロールを付与
  for (const role of ['roles/artifactregistry.writer', 'roles/run.developer']) {
    run(
      `gcloud projects add-iam-policy-binding "${P}"` +
      ` --member="serviceAccount:${SA_EMAIL}"` +
      ` --role="${role}"`,
    );
  }

  // 5. Cloud Run が使う Compute Engine SA への serviceAccountUser 権限
  run(
    `gcloud iam service-accounts add-iam-policy-binding "${computeSA}"` +
    ` --project="${P}"` +
    ` --member="serviceAccount:${SA_EMAIL}"` +
    ` --role="roles/iam.serviceAccountUser"`,
  );

  // 6. GitHub リポジトリを SA に紐付け
  run(
    `gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}"` +
    ` --project="${P}"` +
    ` --role="roles/iam.workloadIdentityUser"` +
    ` --member="principalSet://iam.googleapis.com/${poolResource}/attribute.repository/${owner}/${repo}"`,
  );

  // 設定値を出力
  const wifProvider = `${poolResource}/providers/${PROVIDER}`;
  console.log('\n✓ GitHub Actions 用 GCP 設定が完了しました。');
  console.log('\n以下の値を GitHub Actions Variables に設定してください:');
  console.log('  Settings > Secrets and variables > Actions > Variables\n');
  console.log(`  Name: GCP_PROJECT_ID       Value: ${P}`);
  console.log(`  Name: WIF_PROVIDER         Value: ${wifProvider}`);
  console.log(`  Name: WIF_SERVICE_ACCOUNT  Value: ${SA_EMAIL}`);
  console.log('');
}

function setupSecret() {
  const apiKey = env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    console.error(
      'Error: ANTHROPIC_API_KEY が設定されていません。\n' +
      '実行前に環境変数にセットしてください:\n' +
      '  PowerShell: $env:ANTHROPIC_API_KEY = "sk-ant-..."\n' +
      '  Bash:       export ANTHROPIC_API_KEY="sk-ant-..."',
    );
    process.exit(1);
  }

  // Secret Manager API を有効化
  run(`gcloud services enable secretmanager.googleapis.com --project=${P}`);

  // API キーをシェル引数に渡さないよう一時ファイル経由で Secret を作成
  const tmpFile = path.join(os.tmpdir(), `gcp-secret-${Date.now()}.tmp`);
  try {
    writeFileSync(tmpFile, apiKey, 'utf8');

    const createCmd =
      `gcloud secrets create ${SECRET} --data-file="${tmpFile}" --replication-policy=automatic --project=${P}`;
    console.log(`\n> ${createCmd}\n`);
    let created = true;
    try {
      execSync(createCmd, { stdio: 'inherit', env, shell: true });
    } catch {
      created = false;
    }

    if (!created) {
      console.log(`\nシークレット "${SECRET}" は既に存在するため、新バージョンを追加します。`);
      run(`gcloud secrets versions add ${SECRET} --data-file="${tmpFile}" --project=${P}`);
    }
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }

  // Cloud Run のデフォルト SA（Compute Engine SA）にシークレット読み取り権限を付与
  const projectNumber = execSync(
    `gcloud projects describe ${P} --format=value(projectNumber)`,
    { env, encoding: 'utf8', shell: true },
  ).trim();
  const sa = `${projectNumber}-compute@developer.gserviceaccount.com`;

  run(
    `gcloud secrets add-iam-policy-binding ${SECRET}` +
    ` --member="serviceAccount:${sa}"` +
    ` --role="roles/secretmanager.secretAccessor"` +
    ` --project=${P}`,
  );

  console.log(`\n✓ Secret Manager の設定が完了しました。`);
  console.log(`  デプロイ: npm run gcp:deploy-all\n`);
}

const commands = {
  auth: `gcloud auth login && gcloud config set project ${P}`,
  'artifact-repo': `gcloud artifacts repositories create ${APP} --repository-format=docker --location=${REGION}`,
  build: `gcloud builds submit --tag ${IMAGE}`,
  deploy: [
    `gcloud run deploy ${APP}`,
    `--image ${IMAGE}`,
    `--platform managed`,
    `--region ${REGION}`,
    `--allow-unauthenticated`,
    `--port 3000`,
    `--set-secrets ANTHROPIC_API_KEY=${SECRET}:latest`,
  ].join(' '),
};

const name = process.argv[2];

if (name === 'setup-github-actions') {
  setupGithubActions();
  process.exit(0);
}

if (name === 'setup-secret') {
  setupSecret();
  process.exit(0);
}

const cmd = commands[name];
if (!cmd) {
  const all = ['setup-github-actions', 'setup-secret', ...Object.keys(commands)];
  console.error(`Unknown command: ${name}\nAvailable: ${all.join(', ')}`);
  process.exit(1);
}

run(cmd);
