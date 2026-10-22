/* CrazyGames 用アダプター。SDKが使えない環境（ローカル・他サイト）では何もしない */
window.PLATFORM = (() => {
  const SDK = () => window.CrazyGames && window.CrazyGames.SDK;
  let ok = false, playing = false, finishedGames = 0;
  const call = fn => { if (!ok) return; try { fn(SDK()); } catch (e) { console.warn("[CrazyGames]", e); } };
  const P = {
    noShare: true,          // 外部サイトへのリンク・シェアボタンは出さない
    adPlaying: false,
    async init() {
      try {
        if (SDK()) {
          await Promise.race([SDK().init(), new Promise((_, rej) => setTimeout(() => rej(new Error("init timeout")), 8000))]);
          ok = SDK().environment !== "disabled";
        }
      } catch (e) { ok = false; console.warn("[CrazyGames] init failed", e); }
      call(s => s.game.loadingStart());
      try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
      call(s => s.game.loadingStop());
      document.documentElement.classList.add("on-portal");
    },
    /* 記録はCrazyGamesのアカウントに保存（未ログインならブラウザ内） */
    get storage() { if (ok) { try { if (SDK().data) return SDK().data; } catch (e) {} } return localStorage; },
    /* CrazyGames が教えてくれる言語。日本語以外は英語で表示 */
    get lang() { try { const l = ok && SDK().user.systemInfo.locale; if (l) return /^ja/i.test(l) ? "ja" : "en"; } catch (e) {} return ""; },
    gameplayStart() { if (playing) return; playing = true; call(s => s.game.gameplayStart()); },
    gameplayStop() { if (!playing) return; playing = false; finishedGames++; call(s => s.game.gameplayStop()); },
    happy() { call(s => s.game.happytime()); },
    /* 「もう一回」「次のゲーム」の前に広告。2ゲーム遊ぶまでは出さない。終わるまで画面をふさぐ */
    midgame(next) {
      if (!ok || finishedGames < 2) return next();
      const block = document.createElement("div");
      block.style.cssText = "position:fixed;inset:0;z-index:1000;background:transparent";
      document.body.appendChild(block);
      let done = false, started = false;
      const fin = () => { if (done) return; done = true; P.adPlaying = false; P.onResume && P.onResume(); block.remove(); next(); };
      try {
        SDK().ad.requestAd("midgame", {
          adStarted: () => { started = true; P.adPlaying = true; P.onPause && P.onPause(); },
          adFinished: fin,
          adError: fin,
        });
      } catch (e) { fin(); }
      setTimeout(() => { if (!started) fin(); }, 12000); // 応答がないときの保険
    },
  };
  return P;
})();
