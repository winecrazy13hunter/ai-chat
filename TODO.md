# 実行計画 TODO リスト

## フェーズ 1: プロジェクト初期設定

- [x] **1-1.** `create-next-app` でプロジェクト作成
  ```bash
  npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
  ```
- [x] **1-2.** 追加パッケージのインストール
  ```bash
  npm install ai @ai-sdk/anthropic lucide-react
  npm install -D @types/node
  ```
- [x] **1-3.** shadcn/ui の初期化
  ```bash
  npx shadcn@latest init
  ```
- [x] **1-4.** 必要な shadcn コンポーネントの追加
  ```bash
  npx shadcn@latest add button input scroll-area separator tooltip
  ```
- [x] **1-5.** `.env.local` の作成（`ANTHROPIC_API_KEY` を設定）
- [x] **1-6.** `.env.example` の作成（キー名のみ記載）
- [x] **1-7.** `.gitignore` に `.env.local` が含まれていることを確認（`.env*` で対応済み）
- [x] **1-8.** `next.config.ts` に `output: 'standalone'` を追加

---

## フェーズ 2: 型定義・ユーティリティ

- [x] **2-1.** `lib/types.ts` を作成
  - `Session`型（id, title, createdAt, updatedAt）
  - `StoredMessage`型（id, role, parts, createdAt）※AI SDK v7 UIMessage互換
- [x] **2-2.** `lib/session.ts` を作成（localStorage操作）
  - `getSessions()` — セッション一覧取得
  - `createSession()` — 新規セッション作成
  - `deleteSession(id)` — セッション削除
  - `getMessages(sessionId)` — メッセージ一覧取得
  - `saveMessages(sessionId, messages)` — メッセージ保存
  - `updateSessionTitle(sessionId, title)` — タイトル更新
  - `pruneOldSessions()` — 上限（50件）超過時に古いセッションを削除
- [x] **2-3.** `lib/prompts.ts` を作成
  - システムプロンプト定数を定義
  - ※ `@ai-sdk/react` を追加インストール（useChat用、Phase5で使用）

---

## フェーズ 3: API ルート実装

- [x] **3-1.** `app/api/chat/route.ts` を作成
  - `@ai-sdk/anthropic` で Claude (`claude-sonnet-4-6`) を呼び出す
  - `streamText` → `toUIMessageStream` → `createUIMessageStreamResponse` でストリーミング返却（AI SDK v7パターン）
  - システムプロンプトをサーバーサイドで付与
  - `convertToModelMessages(messages)` で UIMessage → ModelMessage 変換（v7では async）
  - エラーハンドリング（400, 401, 429, 500）実装済み
- [x] **3-2.** API キーがサーバーサイドのみで使われることを確認（クライアント露出なし）

---

## フェーズ 4: UIコンポーネント実装

- [x] **4-1.** `components/Message.tsx` を作成
  - user / assistant のメッセージ表示（右寄せ / 左寄せ）
  - TAB譜（コードブロック）は `<pre>` + `font-mono` で等幅表示
  - コードブロック検出パーサー実装（正規表現で ``` 分割）
  - ストリーミング中カーソルアニメーション表示
- [x] **4-2.** `components/MessageInput.tsx` を作成
  - テキストエリア（`Shift+Enter` で改行、`Enter` で送信）
  - 自動リサイズ（最大200px）
  - ストリーミング中は停止ボタン表示、完了時は送信ボタン表示
- [x] **4-3.** `components/ChatWindow.tsx` を作成
  - メッセージ一覧のスクロールエリア（shadcn ScrollArea）
  - 新メッセージ追加時に自動スクロール
  - 空セッション時のウェルカムメッセージ＋入力例表示
- [x] **4-4.** `components/ChatSidebar.tsx` を作成
  - セッション一覧表示（タイトル・日時、今日は時刻・それ以外は日付）
  - 新規セッション作成ボタン
  - セッション選択・削除機能（ホバーで削除ボタン表示）
  - アクティブセッションのハイライト

---

## フェーズ 5: メインページ実装

- [x] **5-1.** `app/page.tsx` を実装
  - `useChat`（AI SDK v7 / `@ai-sdk/react`）でストリーミング会話を管理
  - ※v7 では `api` オプション廃止 → デフォルト `/api/chat` を使用
  - `setMessages` でセッション切り替え時にlocalStorageから履歴を復元
  - `status === 'ready'` になった時点で自動保存＋初回タイトル生成（28文字）
  - `ChatSidebar` + `ChatWindow` + `MessageInput` を組み合わせ
  - モバイル: サイドバーはスライドイン＋オーバーレイで開閉
  - エラーバナーを最上部に表示
- [x] **5-2.** `app/layout.tsx` を更新
  - `html` に `dark` クラスを付与してダークモードをデフォルトに設定
  - `Noto_Sans_JP` を `--font-sans` 変数にマッピング（日本語フォント対応）
  - `Geist_Mono` を `--font-geist-mono` に設定（TAB譜の等幅フォント）
  - ※`ChatWindow` の scrolling も `min-h-0 flex-1 overflow-y-auto` で修正済み

---

## フェーズ 6: スタイリング・デザイン

- [x] **6-1.** `app/globals.css` でカラーテーマを設定
  - グレー系モノトーン（ビジネスライク）
  - ダークモード対応
- [x] **6-2.** TAB譜表示の等幅フォントが崩れないことをブラウザで確認
- [x] **6-3.** レスポンシブ対応を確認（モバイル・タブレット・PC）

---

## フェーズ 7: 動作確認

- [x] **7-1.** ローカルで `npm run dev` を起動して動作確認
  - TAB譜のリクエスト → 正しく等幅表示されること
  - ストリーミングが正常に動作すること
  - セッション作成・切り替え・削除が正常に動作すること
  - localStorage にデータが保存されること
- [x] **7-2.** エラーケースの確認
  - APIキーなし → わかりやすいエラーメッセージが表示されること
  - レート制限 → 適切にハンドリングされること
- [x] **7-3.** `npm run build` でビルドエラーがないことを確認
- [x] **7-4.** `npm run type-check`（または `tsc --noEmit`）でエラーがないことを確認

---

## フェーズ 8: Docker 化

- [x] **8-1.** `Dockerfile` を作成（Next.js standalone ビルド）
- [x] **8-2.** `.dockerignore` を作成（`node_modules`, `.next`, `.env.local` 等を除外）
- [ ] **8-3.** ローカルで Docker ビルド・起動を確認（ローカルにDockerなし → Cloud Buildで代替）
  ```bash
  docker build -t guitar-tab-bot .
  docker run -p 3000:3000 --env-file .env.local guitar-tab-bot
  ```
- [ ] **8-4.** コンテナ内での動作をブラウザで確認（Cloud Run デプロイ後に確認）

---

## フェーズ 9: Google Cloud Run デプロイ

- [ ] **9-1.** Google Cloud プロジェクトの確認・`gcloud` CLI の認証
- [ ] **9-2.** Artifact Registry リポジトリを作成
  ```bash
  gcloud artifacts repositories create guitar-tab-bot \
    --repository-format=docker \
    --location=asia-northeast1
  ```
- [ ] **9-3.** Cloud Build でイメージをビルド・プッシュ
  ```bash
  gcloud builds submit --tag asia-northeast1-docker.pkg.dev/PROJECT_ID/guitar-tab-bot/app
  ```
- [ ] **9-4.** Cloud Run にデプロイ
  ```bash
  gcloud run deploy guitar-tab-bot \
    --image asia-northeast1-docker.pkg.dev/PROJECT_ID/guitar-tab-bot/app \
    --platform managed \
    --region asia-northeast1 \
    --allow-unauthenticated \
    --port 3000 \
    --set-env-vars ANTHROPIC_API_KEY=sk-ant-...
  ```
- [ ] **9-5.** デプロイ後の本番URLで動作確認

---

## フェーズ 10: バグ修正

### 🔴 クリティカル（動作に影響するバグ）

- [x] **10-1.** `app/layout.tsx` — `Noto_Sans_JP` の subsets 調査
  - 調査結果: `next/font/google` の型定義上 `'japanese'` は存在しない。Noto Sans JP は CJK フォントのため日本語グリフが font 本体に含まれており、`subsets: ['latin']` で正しく動作することを確認済み（N/A）

- [x] **10-2.** `components/MessageInput.tsx` — IME変換中のEnterキー送信バグを修正
  - `handleKeyDown` に `!e.nativeEvent.isComposing` チェックを追加

- [x] **10-3.** `components/Message.tsx` — Markdownのインライン記法をレンダリング
  - `renderInline`（`**bold**` → `<strong>`）と `renderTextSegment`（`- list` → `<ul>`）を実装
  - アシスタントメッセージのみ適用、ユーザーメッセージは `whitespace-pre-wrap` を維持

- [x] **10-4.** `.gitignore` — `.env*` を `.env*.local` に修正
  - `.env.example` が正しくgit追跡されるようになった

- [x] **10-5.** `lib/session.ts` — セッション上限超過時のメッセージ残留を修正
  - `createSession` 内でpruneされたセッションのメッセージキーを `localStorage.removeItem` するよう修正

- [x] **10-6.** `lib/session.ts` — `localStorage` クォータエラーをハンドリング
  - `saveSessions` / `saveMessages` に `QuotaExceededError` catch を追加
  - `page.tsx` のauto-saveエフェクトでエラーを捕捉し、琥珀色バナーで通知

### 🟡 UX問題

- [x] **10-7.** `app/page.tsx` — ストリーミング中のセッション切り替えで `stop()` を呼ぶよう修正
  - `handleSelectSession` / `handleDeleteSession` の先頭で `stop()` を呼ぶよう変更

- [x] **10-8.** `app/page.tsx` — エラーバナーにXボタンを追加
  - APIエラーバナーに閉じるボタン追加（`errorDismissed` state）
  - ストレージエラー用バナーを別途追加（琥珀色、`storageError` state）

- [x] **10-9.** `components/ChatWindow.tsx` — スマート自動スクロールに修正
  - `scrollHeight - scrollTop - clientHeight < 100` の場合のみ自動スクロール

### 🟠 セキュリティ

- [x] **10-10.** `app/api/chat/route.ts` — IP単位のインメモリレート制限を実装
  - 20リクエスト/分（`RATE_LIMIT_MAX = 20`, `RATE_LIMIT_WINDOW_MS = 60_000`）
  - `x-forwarded-for` / `x-real-ip` ヘッダーでIP取得、Map自動クリーンアップ付き

- [x] **10-11.** `app/api/chat/route.ts` — サーバー側メッセージ件数を制限
  - `messages.slice(-20)` で直近20件のみ Claude に送信（`MAX_CONTEXT_MESSAGES = 20`）

---

## 完了チェックリスト

| 機能 | 確認項目 |
|------|---------|
| TAB譜生成 | リクエストに対してASCII TAB譜が等幅で表示される |
| ストリーミング | 回答が文字単位でリアルタイム表示される |
| セッション管理 | 複数セッションの作成・切り替え・削除ができる |
| 履歴保持 | ページ再読み込み後も会話履歴が残る |
| エラー処理 | APIエラー時にユーザーへ通知される |
| モバイル対応 | スマートフォンで正常に操作できる |
| デプロイ | Cloud Run の本番URLでアクセスできる |
