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
const P       = env.PROJECT_ID ?? '';
const APP_URL = env.NEXT_PUBLIC_APP_URL ?? '';
const REGION  = 'asia-northeast1';
const APP     = 'guitar-tab-bot';
const IMAGE   = `${REGION}-docker.pkg.dev/${P}/${APP}/app`;

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

// Secret Manager にシークレットを登録し、Cloud Run の SA に読み取り権限を付与する
// secretName: シークレット名（例: ANTHROPIC_API_KEY, MONGODB_URI）
// secretValue: 登録する値（環境変数から渡す）
function setupSecret(secretName, secretValue) {
  run(`gcloud services enable secretmanager.googleapis.com --project=${P}`);

  // シェル引数に値を渡さないよう一時ファイル経由で登録
  const tmpFile = path.join(os.tmpdir(), `gcp-secret-${Date.now()}.tmp`);
  try {
    writeFileSync(tmpFile, secretValue, 'utf8');

    const createCmd =
      `gcloud secrets create ${secretName} --data-file="${tmpFile}" --replication-policy=automatic --project=${P}`;
    console.log(`\n> ${createCmd}\n`);
    let created = true;
    try {
      execSync(createCmd, { stdio: 'inherit', env, shell: true });
    } catch {
      created = false;
    }

    if (!created) {
      console.log(`\nシークレット "${secretName}" は既に存在するため、新バージョンを追加します。`);
      run(`gcloud secrets versions add ${secretName} --data-file="${tmpFile}" --project=${P}`);
    }
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }

  // Cloud Run のデフォルト SA（Compute Engine SA）に読み取り権限を付与
  const projectNumber = execSync(
    `gcloud projects describe ${P} --format=value(projectNumber)`,
    { env, encoding: 'utf8', shell: true },
  ).trim();
  const sa = `${projectNumber}-compute@developer.gserviceaccount.com`;

  run(
    `gcloud secrets add-iam-policy-binding ${secretName}` +
    ` --member="serviceAccount:${sa}"` +
    ` --role="roles/secretmanager.secretAccessor"` +
    ` --project=${P}`,
  );

  console.log(`\n✓ ${secretName} の Secret Manager 設定が完了しました。`);
  console.log(`  デプロイ: npm run gcp:deploy-all\n`);
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

  const projectNumber = execSync(
    `gcloud projects describe ${P} --format=value(projectNumber)`,
    { env, encoding: 'utf8', shell: true },
  ).trim();

  const SA_NAME      = 'github-actions-sa';
  const SA_EMAIL     = `${SA_NAME}@${P}.iam.gserviceaccount.com`;
  const POOL         = 'github-actions';
  const PROVIDER     = 'github-provider';
  const computeSA    = `${projectNumber}-compute@developer.gserviceaccount.com`;
  const poolResource = `projects/${projectNumber}/locations/global/workloadIdentityPools/${POOL}`;

  runIgnoreExists(
    `gcloud iam workload-identity-pools create "${POOL}"` +
    ` --project="${P}" --location="global"` +
    ` --display-name="GitHub Actions"`,
  );

  runIgnoreExists(
    `gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}"` +
    ` --project="${P}" --location="global"` +
    ` --workload-identity-pool="${POOL}"` +
    ` --display-name="GitHub Provider"` +
    ` --issuer-uri="https://token.actions.githubusercontent.com"` +
    ` --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"` +
    ` --attribute-condition="assertion.repository=='${owner}/${repo}'"`,
  );

  runIgnoreExists(
    `gcloud iam service-accounts create "${SA_NAME}"` +
    ` --project="${P}"` +
    ` --display-name="GitHub Actions Service Account"`,
  );

  for (const role of ['roles/artifactregistry.writer', 'roles/run.developer']) {
    run(
      `gcloud projects add-iam-policy-binding "${P}"` +
      ` --member="serviceAccount:${SA_EMAIL}"` +
      ` --role="${role}"`,
    );
  }

  run(
    `gcloud iam service-accounts add-iam-policy-binding "${computeSA}"` +
    ` --project="${P}"` +
    ` --member="serviceAccount:${SA_EMAIL}"` +
    ` --role="roles/iam.serviceAccountUser"`,
  );

  run(
    `gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}"` +
    ` --project="${P}"` +
    ` --role="roles/iam.workloadIdentityUser"` +
    ` --member="principalSet://iam.googleapis.com/${poolResource}/attribute.repository/${owner}/${repo}"`,
  );

  const wifProvider = `${poolResource}/providers/${PROVIDER}`;
  console.log('\n✓ GitHub Actions 用 GCP 設定が完了しました。');
  console.log('\n以下の値を GitHub Actions Variables に設定してください:');
  console.log('  Settings > Secrets and variables > Actions > Variables\n');
  console.log(`  Name: GCP_PROJECT_ID         Value: ${P}`);
  console.log(`  Name: WIF_PROVIDER           Value: ${wifProvider}`);
  console.log(`  Name: WIF_SERVICE_ACCOUNT    Value: ${SA_EMAIL}`);
  if (APP_URL) {
    console.log(`  Name: NEXT_PUBLIC_APP_URL    Value: ${APP_URL}`);
  }
  console.log('');
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
    `--set-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,MONGODB_URI=MONGODB_URI:latest`,
    ...(APP_URL ? [`--set-env-vars NEXT_PUBLIC_APP_URL=${APP_URL}`] : []),
  ].join(' '),
};

const name = process.argv[2];

if (name === 'setup-github-actions') {
  setupGithubActions();
  process.exit(0);
}

if (name === 'setup-secret') {
  // secretName は省略時 ANTHROPIC_API_KEY、指定時はその名前を使用
  // 例: node scripts/gcp.js setup-secret MONGODB_URI
  const secretName  = process.argv[3] ?? 'ANTHROPIC_API_KEY';
  const secretValue = env[secretName] ?? '';
  if (!secretValue) {
    console.error(
      `Error: ${secretName} が環境変数に設定されていません。\n` +
      `実行前にセットしてください:\n` +
      `  PowerShell: $env:${secretName} = "..."\n` +
      `  Bash:       export ${secretName}="..."`,
    );
    process.exit(1);
  }
  setupSecret(secretName, secretValue);
  process.exit(0);
}

const cmd = commands[name];
if (!cmd) {
  const all = ['setup-github-actions', 'setup-secret [SECRET_NAME]', ...Object.keys(commands)];
  console.error(`Unknown command: ${name}\nAvailable: ${all.join(', ')}`);
  process.exit(1);
}

run(cmd);
