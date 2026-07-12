# Guitar TAB Bot - Makefile
# 使い方: make <ターゲット>
# PROJECT_ID は .env.gcp から自動読み込み（なければデフォルト値を使用）

-include .env.gcp
export

PROJECT_ID ?= your-project-id
REGION     := asia-northeast1
APP_NAME   := guitar-tab-bot
IMAGE      := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(APP_NAME)/app

NODE_OPTIONS := --use-system-ca

.PHONY: install dev build type-check \
        docker-build docker-run \
        gcp-auth artifact-repo cloud-build setup-secret setup-github-actions deploy deploy-all \
        help

# ── ローカル開発 ────────────────────────────────────────────────────────────────

install:			## 依存パッケージをインストール
	NODE_OPTIONS=$(NODE_OPTIONS) npm install

dev:				## 開発サーバー起動 (http://localhost:3000)
	NODE_OPTIONS=$(NODE_OPTIONS) npm run dev

build:				## プロダクションビルド
	NODE_OPTIONS=$(NODE_OPTIONS) npm run build

type-check:			## TypeScript 型チェック
	NODE_OPTIONS=$(NODE_OPTIONS) npx tsc --noEmit

# ── Docker（ローカル確認用）────────────────────────────────────────────────────

docker-build:			## Docker イメージをローカルビルド
	docker build -t $(APP_NAME) .

docker-run:			## Docker コンテナをローカル起動 (http://localhost:3000)
	docker run --rm -p 3000:3000 --env-file .env.local $(APP_NAME)

# ── Google Cloud Run デプロイ ───────────────────────────────────────────────────

gcp-auth:			## gcloud 認証 & プロジェクト設定
	gcloud auth login
	gcloud config set project $(PROJECT_ID)

artifact-repo:			## Artifact Registry リポジトリを作成（初回のみ）
	gcloud artifacts repositories create $(APP_NAME) \
		--repository-format=docker \
		--location=$(REGION)

cloud-build:			## Cloud Build でイメージをビルド & プッシュ
	gcloud builds submit --tag $(IMAGE)

setup-secret:			## APIキーをSecret Managerに登録 & Cloud Run権限付与（初回のみ）
	node scripts/gcp.js setup-secret

setup-github-actions:		## GitHub Actions 用 WIF & SA 設定（初回のみ）
	node scripts/gcp.js setup-github-actions

deploy:				## Cloud Run にデプロイ（APIキーはSecret Managerから取得）
	gcloud run deploy $(APP_NAME) \
		--image $(IMAGE) \
		--platform managed \
		--region $(REGION) \
		--allow-unauthenticated \
		--port 3000 \
		--set-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest

deploy-all: cloud-build deploy	## ビルド & デプロイを一括実行

# ── ヘルプ ──────────────────────────────────────────────────────────────────────

help:				## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*##"}; {printf "  %-18s %s\n", $$1, $$2}'
