# sawatdee-official

サワディ兄弟（タイ料理店・神奈川県川崎市）公式サイト。

## 本番URL

https://sawatdee-official.pages.dev/

## 技術スタック

- HTML / CSS / JavaScript（バニラ・フレームワークなし）
- Cloudflare Pages（自動デプロイ）
- 同組織の他プロジェクト（POS / 予約 / 勤怠 / お楽しみ）と同流儀

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | トップページ（ヒーロー・店舗情報・関連リンク） |
| `style.css` | スタイル（タイカラー: 赤/ゴールド/緑） |
| `script.js` | 営業時間の動的「営業中/閉店中」表示 |

## Phase 計画

- **Phase 1（本リポ・実装中）**: 骨格（店舗情報・予約導線・お楽しみリンク）
- **Phase 2**: メニュー充実（写真・価格・説明）
- **Phase 3**: お楽しみページの「こだわり要素」統合
- **Phase 4**: SEO/SNS（OGP・構造化データ・サイトマップ）

## 関連リポ

| プロジェクト | リポ | URL |
|---|---|---|
| POS | sawatdee-bros/sawatdee-pos | https://sawatdee-pos.pages.dev/ |
| 予約 | sawatdee-bros/sawatdee-reservation | https://sawatdee-reservation.pages.dev/ |
| 勤怠 | sawatdee-bros/sawatdee-attendance | https://sawatdee-attendance.pages.dev/ |
| お楽しみ | sawasdee-pos 配下 (saas-refresh で独立予定) | https://sawatdee-pos.pages.dev/funpage.html |

## デプロイ

GitHub push → Cloudflare Pages が自動ビルド → 1-2分で反映。

## 店舗情報（コード内で参照）

- 住所: 神奈川県川崎市中原区上小田中5-3-10
- 電話: 044-777-6759
- 営業時間: 水・木 17:30–24:00 / 金・土 17:30–翌2:00 / 日 14:00–23:00 / 月・火 定休
