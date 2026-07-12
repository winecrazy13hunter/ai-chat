# AI ギターTABチャットボット

## プロジェクト概要

ギターTAB譜を提供するAIチャットボット。ユーザーが曲名・アーティスト名を入力すると、AIがギターTAB譜（ASCII形式）および演奏情報を日本語で提供する。認証なし（匿名）で利用可能。会話履歴はブラウザのlocalStorageに保存する。

## 技術スタック

| カテゴリ | 技術 |
|--------|------|
| フロントエンド | Next.js 15 (App Router) |
| AI | Claude API (`claude-sonnet-4-6`) |
| AI SDK | Vercel AI SDK v4 (`ai` パッケージ) |
| セッション管理 | ブラウザ localStorage（DBなし） |
| スタイリング | Tailwind CSS v4 + shadcn/ui |
| デプロイ | Google Cloud Run (`asia-northeast1`) |
| コンテナ | Docker（Next.js standalone ビルド） |

## アーキテクチャ

```
ブラウザ
├── localStorage
│   ├── sessions[]        # セッション一覧（ID・タイトル・作成日時）
│   └── messages:{id}[]   # セッションごとの会話履歴
└── Next.js App Router
    ├── app/page.tsx              # メインチャット画面
    ├── app/api/chat/route.ts     # Claude APIストリーミングエンドポイント
    ├── components/
    │   ├── ChatSidebar.tsx       # セッション一覧・切り替え
    │   ├── ChatWindow.tsx        # 会話表示エリア
    │   ├── Message.tsx           # メッセージ1件（TAB譜等幅対応）
    │   └── MessageInput.tsx      # 入力フォーム
    └── lib/
        ├── session.ts            # localStorage操作
        └── types.ts              # 型定義
```

## 主要機能

### 1. ギターTAB譜提供
- 曲名・アーティスト名を入力するとASCII形式のTAB譜を生成
- コード進行・チューニング・難易度情報を日本語で補足
- TAB譜は等幅フォント（`font-mono`）で表示し、崩れを防ぐ

### 2. ストリーミング回答
- Vercel AI SDK の `useChat` フックを使用
- 文字単位でリアルタイム表示
- ストリーミング中もTAB譜レイアウトが崩れないようにする

### 3. 複数セッション管理
- サイドバーで複数の会話セッションを切り替え
- セッションタイトルは最初のユーザー発言から自動生成
- 最大50セッションを保持し、上限超過時は古いものから削除

## ファイル構成

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── chat/
│           └── route.ts
├── components/
│   ├── ChatSidebar.tsx
│   ├── ChatWindow.tsx
│   ├── Message.tsx
│   └── MessageInput.tsx
├── lib/
│   ├── session.ts
│   └── types.ts
├── Dockerfile
├── .env.local            # ローカル開発用（Gitに含めない）
├── .env.example
└── package.json
```

## 環境変数

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...   # Claude APIキー（必須）
```

Cloud Run へのデプロイ時は `--set-env-vars` または Secret Manager で設定する。

## システムプロンプト

```
あなたはギター演奏を支援するAIアシスタントです。
ユーザーからリクエストされた楽曲のギターTAB譜をASCII形式で提供してください。

【ルール】
- 回答は必ず日本語で行うこと
- TAB譜は標準6弦ギター向けに記述すること（チューニング: E A D G B e）
- 数字はフレット番号、0はオープン弦を表す
- 難しいフレーズには運指のコツを添えること
- 著作権上の理由でTABを提供できない場合はその旨を明示し、代替情報（コード進行・参考サイト等）を提供すること
- 音楽理論・奏法に関する質問にも対応すること
- TAB譜以外の話題（音楽と無関係な質問）には丁重に対応範囲外と伝えること
```

## UIデザイン方針

- カラーパレット: グレー系モノトーン（ビジネスライク）
- ダークモード: 対応する
- レイアウト: 左サイドバー（240px・セッション一覧）＋ 右メインエリア（チャット）
- TAB譜表示: `<pre>` タグ + `font-mono` で等幅を保証
- フォント: システムフォント（日本語対応）

## 開発コマンド

npm scripts（Windows対応）と Makefile（Mac/Linux）の両方が使えます。
`NODE_OPTIONS=--use-system-ca` は `.npmrc` で自動適用されます。

### npm scripts

```powershell
# 依存パッケージインストール
npm install

# 開発サーバー起動 (http://localhost:3000)
npm run dev

# 型チェック
npm run type-check

# プロダクションビルド
npm run build

# Dockerイメージビルド（ローカル確認用）
npm run docker:build
npm run docker:run
```

### Makefile（Mac/Linux）

```bash
make install      # 依存パッケージインストール
make dev          # 開発サーバー起動
make type-check   # TypeScript 型チェック
make build        # プロダクションビルド
make docker-build # Docker イメージビルド
make docker-run   # Docker コンテナ起動
make help         # コマンド一覧表示
```

## Cloud Run デプロイ

ANTHROPIC_API_KEY は **Google Cloud Secret Manager** で管理する。`.env.gcp` に PROJECT_ID を設定してから実行する。

### セットアップ手順（初回のみ）

```powershell
# 1. 認証 & Artifact Registry 作成
npm run gcp:auth
npm run gcp:artifact-repo

# 2. APIキーを Secret Manager に登録（シェル履歴に残らないよう一時ファイル経由）
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # セッション内のみ有効
npm run gcp:setup-secret                 # Secret Manager 登録 + Cloud Run 権限付与
# ↑ 実行後は $env:ANTHROPIC_API_KEY を unset して構わない
```

Makefile（Mac/Linux）の場合:

```bash
make gcp-auth
make artifact-repo
ANTHROPIC_API_KEY="sk-ant-..." make setup-secret
```

### デプロイ（通常運用）

APIキーは Secret Manager から自動取得されるため、環境変数の設定は不要。

```powershell
# npm scripts（Windows）
npm run gcp:deploy-all   # ビルド & デプロイ（一括）
npm run gcp:build        # Cloud Build でイメージのみビルド
npm run gcp:deploy       # Cloud Run のみデプロイ
```

```bash
# Makefile（Mac/Linux）
make deploy-all   # ビルド & デプロイ（一括）
make cloud-build  # イメージのみビルド
make deploy       # Cloud Run のみデプロイ
```

### APIキーのローテーション

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-新しいキー..."
npm run gcp:setup-secret   # 新バージョンを追加（既存バージョンは保持）
npm run gcp:deploy         # :latest が新バージョンを参照
```

## GitHub Actions デプロイ

`main` ブランチへの push で自動デプロイ。**Workload Identity Federation (WIF)** を使用し、サービスアカウントキーを GitHub に保存しない。

### セットアップ手順（初回のみ）

#### 1. `.env.gcp` に GitHub リポジトリ情報を追記

```
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name
```

#### 2. WIF・サービスアカウントの設定

```powershell
npm run gcp:setup-github-actions
```

```bash
make setup-github-actions  # Mac/Linux
```

コマンド完了後に以下の3つの値が出力される。

#### 3. GitHub Actions Variables に設定

リポジトリの **Settings > Secrets and variables > Actions > Variables** で追加:

| Name | Value |
|------|-------|
| `GCP_PROJECT_ID` | `ai-chat-wc-20260710` |
| `WIF_PROVIDER` | `projects/.../providers/github-provider`（出力値） |
| `WIF_SERVICE_ACCOUNT` | `github-actions-sa@...iam.gserviceaccount.com`（出力値） |

#### 4. 動作確認

`main` ブランチに push するとワークフローが起動し、自動でビルド・デプロイが実行される。
手動実行は GitHub の Actions タブ → `Deploy to Cloud Run` → `Run workflow`。

### ワークフローの概要（`.github/workflows/deploy.yml`）

| ステップ | 内容 |
|----------|------|
| Auth | WIF でキーレス認証 |
| Docker build & push | コミット SHA タグでイメージをビルド → Artifact Registry にプッシュ |
| Cloud Run deploy | `--set-secrets` で Secret Manager から API キーを注入 |
| Show URL | デプロイ先 URL を出力 |

## Dockerfile（Next.js standalone）

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

`next.config.ts` に `output: 'standalone'` を設定すること。

## 主要パッケージ

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "tailwindcss": "^4.0.0",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "latest",
    "@types/react": "latest"
  }
}
```

## 実装上の注意事項

1. **TAB譜の等幅表示**: ストリーミング途中でも `<pre>` タグで囲み、レイアウト崩れを防ぐ
2. **localStorageの容量制限**: セッション上限は50件、メッセージ上限はセッションあたり200件
3. **著作権への配慮**: システムプロンプトで著作権に関する注意事項を明記し、AIが適切に判断できるようにする
4. **エラーハンドリング**: Claude APIのレート制限・タイムアウト時はユーザーにわかりやすいエラーメッセージを表示する
5. **セキュリティ**: `ANTHROPIC_API_KEY` はサーバーサイド（`route.ts`）のみで使用し、クライアントに露出させない

## 非機能要件

| 項目 | 要件 |
|------|------|
| 対応言語 | 日本語のみ |
| 認証 | 不要（匿名利用） |
| データ永続化 | localStorage（サーバーDBなし） |
| レスポンス方式 | ストリーミング |
| モバイル対応 | レスポンシブ対応する |
