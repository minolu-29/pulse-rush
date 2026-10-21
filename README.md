# Pulse Rush

ブラウザで遊べる無料の音ゲー。12ジャンル・42曲のオリジナル曲を、簡単・普通・難しい・鬼の4段階で遊べます。

- 曲と譜面: `src/music.js`（曲データから Web Audio で音を作り、同じデータから4段階の譜面を作る。外部の音源は使わない）
- ゲーム本体: `src/game.js`、画面: `src/index.html`
- 配信先ごとの広告: `src/platforms/`（自分のサイト=AdSense、GameDistribution、CrazyGames）
- `node tools/build.mjs` で `dist/` に各配信先の版を作る。main に入ると GitHub Actions が Pages に公開し、提出用 ZIP とサムネイルを Releases「latest」に置く
- 曲を増やすときは `src/music.js` の `LIST` に [ジャンル, 曲名] を足すだけ（曲名から乱数の種が決まり、毎回同じ曲になる）

ローカルで試す: `npx http-server src` を開く（`?auto` を付けると自動演奏、`?lang=en` で英語）
