This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 開発環境のセットアップ手順

### 前提条件

- Node.js 20 以上
- npm
- （Docker での動作確認を行う場合）Docker

### 1. リポジトリのクローン

```bash
git clone https://github.com/winecrazy13hunter/ai-chat.git
cd ai-chat
```

### 2. 依存パッケージのインストール

```bash
npm install
```

Mac/Linux では Makefile も利用できます（`make help` でコマンド一覧を表示）。

```bash
make install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、必要な値を設定してください。

```bash
cp .env.example .env.local
```

| 変数名 | 説明 |
|--------|------|
| `ANTHROPIC_API_KEY` | Claude APIキー（必須） |
| `MONGODB_URI` | MongoDB接続文字列（必須） |

`.env.local` はGit管理対象外（`.gitignore`）のため、各自ローカルで設定してください。

### 4. 開発サーバーの起動

```bash
npm run dev
# または
make dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開いて動作を確認してください。`app/page.tsx` を編集するとページが自動更新されます。

### 5. 型チェック・Lint

```bash
npm run type-check
npm run lint
# または
make type-check
```

### 6. プロダクションビルド

```bash
npm run build
# または
make build
```

### 7. Dockerでの動作確認（任意）

```bash
npm run docker:build
npm run docker:run
# または
make docker-build
make docker-run
```

[http://localhost:3000](http://localhost:3000) で動作確認できます。

Cloud RunへのデプロイやGitHub Actionsの設定については [CLAUDE.md](./CLAUDE.md) を参照してください。

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
 
GitHub Actions test 
 
Test run 2 
