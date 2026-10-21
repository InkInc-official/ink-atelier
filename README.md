# Ink Atelier

**ComfyUI 用の軽量 Web フロントエンド。完全ローカル・外部サービス不要。**

> Ink Inc. | AI Creation, Human Care. The Future Drawn Together.

> ⚠ **メンテナンス終了のお知らせ**
> 本プロジェクトは公開時点で開発・保守を終了しています。現状のまま（as-is）で公開しており、サポートや更新の予定はありません。自由にフォーク・改変してお使いください。

---

## 概要

Ink Atelier は ComfyUI の API をバックエンドとして動作する Web フロントエンドです。
ビルド不要・フレームワーク不使用で、HTML / CSS / JavaScript だけで動きます。
外部 API や有料サービスは使いません。

---

## 機能

- **Generate** — Checkpoint / LoRA / Positive / Negative / サイズ / 参照画像を指定して生成
- **フォーマットプリセット** — 立ち絵・SD・一枚絵（縦／横）のサイズと生成設定を切り替え（`js/config.js` で編集可能）
- **Gallery** — 生成済み画像の一覧・拡大・ダウンロード・リサイズして保存・プロンプト再利用・非表示
- **Prompt Notes** — Positive / Negative / モデル / LoRA をセットで保存・再利用
- **Schedule** — 予約内容を `schedule.json` として書き出し（実行側は別途必要です。下記参照）
- **スマホ画面** — `mobile.html`
- **進捗監視** — ComfyUI の WebSocket で生成状況を表示

---

## 動作環境

| 項目 | 内容 |
|---|---|
| バックエンド | [ComfyUI](https://github.com/comfyanonymous/ComfyUI)（ローカル） |
| フロントエンド | HTML / CSS / JavaScript（バニラ） |
| 推奨ブラウザ | Chrome |
| 接続 | 同一 PC、LAN、または VPN（Tailscale 等） |

> Checkpoint / LoRA などのモデルファイルは同梱していません。各自で ComfyUI に用意してください。
>
> 画面の「GPU」モードは ComfyUI の OpenVINO 用ノード（`TorchCompileDiffusionOpenVINO`）を使います。導入していない環境では「CPU」モードに切り替えてください。

---

## ファイル構成

```
ink-atelier/
├── index.html     # メイン画面
├── style.css      # スタイル
├── js/            # 機能ごとのスクリプト（config.js が設定ファイル）
├── mobile.html    # スマホ用画面
├── icon.png       # アイコン（ライセンス対象外）
├── logo.png       # ロゴ（ライセンス対象外）
├── LICENSE
└── README.md
```

---

## セットアップ

### 1. ComfyUI を CORS 許可で起動

```bash
python main.py --enable-cors-header
```

LAN や VPN の別端末から使う場合は `--listen 0.0.0.0` も付けてください。

### 2. 接続先を設定

`js/config.js` の先頭を環境に合わせて変更します。

```javascript
const COMFYUI_URL = 'http://localhost:8188';
const OUTPUT_API_URL = 'http://localhost:3101'; // 任意（下記参照）
```

スマホ画面（`mobile.html`）は、ファイル内の `const COMFYUI = '...'` を同じ接続先に変更してください。

### 3. 起動

```bash
cd ink-atelier
python3 -m http.server 3100
```

ブラウザで `http://localhost:3100` を開きます。

---

## Output API（任意）

Gallery は、まず `OUTPUT_API_URL` の `/outputs` から画像一覧を取得します。
**この API は同梱していません。** 取得できない場合は自動的に ComfyUI の `/history` にフォールバックするため、なくても動作します。
ComfyUI の履歴に依存しない一覧が欲しい場合は、各自で `GET /outputs?limit=N` を実装してください。

---

## Schedule（予約生成）について

Schedule タブは予約内容を `schedule.json` として書き出すところまでを担当します。
**実際に指定時刻に生成を実行するスケジューラは同梱していません。**
`schedule.json` を読み込み、ComfyUI の `/prompt` を叩く処理を各自で用意してください。

---

## ライセンス

MIT License（表記義務付き）。詳細は [LICENSE](./LICENSE) を参照してください。

- 派生物・再配布では、原作が分かるように
  `Based on Ink Atelier by Ink Inc. (https://github.com/InkInc-official/ink-atelier)`
  の表記を残してください（README・About 画面・ドキュメントなど場所は自由です）。
- `logo.png` / `icon.png` はライセンス対象外です。使っても使わなくても構いませんが、ご自身のプロジェクトのブランドとしては使用しないでください。

---

## Library タブ（任意）

Library タブは、`index.html` と同じフォルダに置いた次の Markdown ファイルを読み込んで表示します。
**これらのファイルは同梱していません。** 必要な人が自分で用意してください。ファイルがなくても他の機能は動作します（Library タブに「見つかりません」と表示されるだけです）。

| ファイル | 表示される場所 |
|---|---|
| `tips.md` | Library 上部のピン留め欄（自分用のメモ・推奨設定など） |
| `checkpoints_guide.md` | Checkpoint 図鑑 |
| `lora_guide.md` | LoRA 図鑑 |

図鑑ファイルの書式は、1項目ごとに `#### 名前` の見出しと `- **項目名**：内容` の箇条書きを並べる形です。細かい解釈は `js/library.js` を参照してください。

---

*Ink Inc. | AI Creation, Human Care. The Future Drawn Together.*
*© 2026 Ink Inc. (黒井葉跡)*
