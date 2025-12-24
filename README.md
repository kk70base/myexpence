# スマート経費アプリ

## 🚀 ローカルで動かす方法

必要なもの: Node.js (https://nodejs.org/)

1. このフォルダをターミナルで開く
2. 以下のコマンドを実行してライブラリをインストール
   `npm install`
3. アプリを起動
   `npm run dev`
4. ブラウザで表示されたURL (http://localhost:5173 等) を開く

## 🌐 ネットに公開する方法 (Netlify 推奨)

一番簡単な **GitHub + Netlify** の方法を紹介します。
黒い画面（コマンド）は使いません！ブラウザだけで完結します。

### ステップ1: GitHubにアップロード

1. **GitHubにログイン**
   - [GitHub](https://github.com/) にアクセスしてログイン（アカウントがない場合は作成）します。

2. **リポジトリ（保管場所）を作成**
   - 画面右上の「＋」アイコンをクリックし、「New repository」を選択します。
   - **Repository name** に好きな名前（例: `my-expense-app`）を入力します。
   - **Public**（公開）を選択します。
   - 他の設定は触らず、一番下の緑色のボタン **Create repository** をクリックします。

3. **ファイルをアップロード**
   - 作成された画面の中に、「…or create a new repository on the command line」などの文字が並んでいますが、その下の方にあるリンクを探します。
   - **「uploading an existing file」** という青いリンクをクリックしてください。
   - ファイルアップロード画面になります。
   - さきほど解凍したフォルダの中身（`package.json`, `index.html`, `src`フォルダなど**すべて**）を選択し、ブラウザの枠内にドラッグ＆ドロップします。
   - ファイルがリストアップされるのを待ちます。
   - 画面下の **Commit changes** という緑色のボタンをクリックします。
   - 少し待つと、ファイルがGitHub上に登録されます。

### ステップ2: Netlifyで公開

1. [Netlify](https://www.netlify.com/) にアクセスし、"Sign up" または "Log in" から **GitHubアカウントでログイン** します。
2. ダッシュボード（管理画面）の **"Add new site"** ボタンを押し、**"Import from existing project"** を選択します。
3. **"Connect to Git provider"** の中から **GitHub** を選択します。
4. リストから、ステップ1で作ったリポジトリ（例: `my-expense-app`）を選択します。
5. 設定画面が出ますが、**何も変更せずに** 一番下の **"Deploy site"** ボタンをクリックします。
6. 数分待つと、`https://random-name.netlify.app` のようなURLが発行され、公開完了です！

## ⚙️ 公開後の初期設定

アプリを開いたら、以下の設定を行ってください。

1. 初回起動時のパスコード設定
2. 右上の設定アイコンから:
   - GASウェブアプリURL
   - Gemini APIキー
   を入力して保存
