/* GameDistribution 用アダプター。ゲームIDは monetize.config.json の gamedistribution.gameId から入る。
   GameDistribution に載ると、提携している多数のゲームサイトに自動で配られ、広告収益が分配される */
window.PLATFORM = (() => {
  const C = window.MONETIZE || {};
  let ready = false, finishedGames = 0, resume = null;
  const P = {
    noShare: true,          // 外部サイトへのリンクは禁止されているので出さない
    adPlaying: false,
    init() {
      document.documentElement.classList.add("on-portal");
      if (!C.gdGameId) return Promise.resolve();
      return new Promise(res => {
        window.GD_OPTIONS = {
          gameId: C.gdGameId,
          onEvent(ev) {
            if (ev.name === "SDK_READY") { ready = true; res(); }
            if (ev.name === "SDK_GAME_PAUSE") { P.adPlaying = true; P.onPause && P.onPause(); } // 広告中は音を止める
            if (ev.name === "SDK_GAME_START") { P.adPlaying = false; P.onResume && P.onResume(); if (resume) { const f = resume; resume = null; f(); } }
          },
        };
        const s = document.createElement("script");
        s.src = "https://html5.api.gamedistribution.com/main.min.js"; s.onerror = () => res();
        document.head.appendChild(s);
        setTimeout(res, 5000); // SDKが来なくてもゲームは始める
      });
    },
    gameplayStop() { finishedGames++; },
    midgame(next) {
      if (!ready || finishedGames < 1 || !window.gdsdk) return next();
      const block = document.createElement("div");
      block.style.cssText = "position:fixed;inset:0;z-index:1000;background:transparent";
      document.body.appendChild(block);
      let done = false;
      const fin = () => { if (done) return; done = true; P.adPlaying = false; P.onResume && P.onResume(); block.remove(); next(); };
      resume = fin;
      try { window.gdsdk.showAd().then(fin, fin); } catch (e) { fin(); }
      setTimeout(() => { if (!P.adPlaying) fin(); }, 8000); // 応答がないときの保険
    },
  };
  return P;
})();
