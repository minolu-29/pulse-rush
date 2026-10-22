/* 自分のサイト用アダプター。monetize.config.json に AdSense の ID があるときだけ広告を出す。
   広告は Google の「H5 ゲーム広告（Ad Placement API）」の adBreak を使い、「もう一回」「次のゲーム」の前にだけ出す */
window.PLATFORM = (() => {
  const C = window.MONETIZE || {};
  let finishedGames = 0;
  const P = {
    noShare: false,
    adPlaying: false,
    async init() {
      if (C.adsenseClient) {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adBreak = window.adConfig = o => window.adsbygoogle.push(o);
        window.adConfig({ preloadAdBreaks: "on", sound: "on" });
      }
    },
    gameplayStop() { finishedGames++; },
    midgame(next) {
      if (!C.adsenseClient || finishedGames < 2) return next();
      let done = false, started = false;
      const fin = () => { if (done) return; done = true; P.adPlaying = false; next(); };
      try {
        window.adBreak({
          type: "next", name: "next-game",
          beforeAd: () => { started = true; P.adPlaying = true; P.onPause && P.onPause(); },
          afterAd: () => { P.adPlaying = false; P.onResume && P.onResume(); },
          adBreakDone: fin,
        });
      } catch (e) { fin(); }
      setTimeout(() => { if (!started) fin(); }, 1500); // 広告ブロックなどで応答がないときはすぐ次へ
    },
    track(name, params) { if (C.ga4 && window.gtag) window.gtag("event", name, params); },
  };
  return P;
})();
