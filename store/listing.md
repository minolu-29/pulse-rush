# ゲームサイト提出用テキスト

提出フォームは英語なので、英語の文をそのままコピーして使ってください。日本語訳は確認用です。
アップロードするファイルとサムネイルは、GitHub の Releases「latest」に自動で置かれます。

## Pulse Rush（pulse-rush）

**Title**
Pulse Rush - Rhythm Game

**Description（英語）**
Feel the beat and tap to the music! Pulse Rush is a neon rhythm game with 42 original tracks across 12 genres: EDM, Future Bass, Hyperpop, Drum & Bass, Synthwave, Lo-fi, Chiptune, House, Trap, J-Core, Kawaii Bass and Dubstep. Every song has four difficulties, from Easy for your first try to Oni for rhythm game veterans. Hit notes as they reach the line, hold long notes, chain combos, and aim for FULL COMBO, ALL PERFECT and the SSS rank. Adjust note speed and timing offset to match your style.

（日本語訳）ビートに合わせてタップ！12ジャンル・42曲のオリジナル曲を収録したネオン系リズムゲーム。全曲に「簡単・普通・難しい・鬼」の4段階。ノーツが線に重なったらタップ、長いノーツは押し続ける。フルコンボ、オールパーフェクト、SSSランクを目指そう。ノーツの速さとタイミングも調整できます。

**Instructions / Controls**
- Mobile: tap the 4 lanes when notes reach the line. Hold long notes until the end.
- Keyboard: D F J K (or arrow keys). Esc to pause.
- Choose a song and a difficulty (Easy / Normal / Hard / Oni), then press PLAY.

**Category / Tags（候補）**
Category: Music (または Casual) / Tags: rhythm, music, piano, tap, beat, neon, edm, arcade, skill, 1 player

## GameDistribution の設定

1. GameDistribution でゲームを新規登録して、もらった Game ID を `monetize.config.json` の `gamedistribution.gameId` に入れて main に入れる
2. 数分後に Releases「latest」に作り直される `pulse-rush-gamedistribution.zip` をアップロードする
3. サムネイルは Releases「latest」の `pulse-rush-gd-*.jpg`（512×384・512×512・200×120・1280×720・1280×550）
4. 画面の向き: Both（縦でも横でも遊べます）。スマホ対応: Yes
5. 言語: English, Japanese（ブラウザの言語で自動切り替え）

## 収録曲の権利について

収録曲はすべてこのゲームのためにプログラムで生成したオリジナル曲です（`src/music.js` が曲データからその場で音を作ります）。
外部の音源・サンプル・既存曲は使っていないため、著作権の問題はありません。
