/* Pulse Rush の曲と譜面は、すべてこのファイルの中で作る。
   外部の音源ファイルは使わず、曲データ（ジャンル・テンポ・キー・乱数の種）から毎回同じ曲を Web Audio で鳴らすので、著作権の心配がない。
   同じ曲からは、音とまったく同じタイミングの譜面（簡単・普通・難しい・鬼）も作る */
window.Music = (() => {
"use strict";

/* ---------- 乱数と音階 ---------- */
const rngOf = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const SCALE = {
  minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11], mixo: [0, 2, 4, 5, 7, 9, 10],
};
const degToSemi = (mode, n) => mode[((n % 7) + 7) % 7] + 12 * Math.floor(n / 7);

/* ---------- ジャンル ----------
   リズムは1小節16マス。x=強く o=弱く。half=ハーフタイム（スネアが3拍目） */
const GENRES = {
  edm: { label: "EDM", bpm: [126, 130], modes: ["minor"], color: ["#00e5ff", "#6a5cff"],
    kick: ["x...x...x...x..."], snare: ["....x.......x..."], snareKind: "clap",
    hat: ["..x...x...x...x.", "..x.x.x...x.x.x."], openHat: true,
    bass: "offbeat", pad: "supersaw", lead: "saw", progs: [[0, 5, 2, 6], [5, 3, 0, 4], [0, 3, 5, 6], [0, 5, 3, 4]], dens: [0.32, 0.5] },
  future: { label: "Future Bass", bpm: [146, 152], half: true, modes: ["major"], color: ["#ff8ad8", "#8a7dff"],
    kick: ["x.........x.....", "x......x..x....."], snare: ["........x......."], snareKind: "clap",
    hat: ["x.x.x.x.x.x.x.x.", "x.x.x.xxx.x.x.x."], bass: "sustain", pad: "chop", lead: "pluck",
    progs: [[3, 4, 2, 5], [0, 4, 5, 3], [5, 3, 0, 4], [3, 4, 5, 5]], dens: [0.3, 0.5], fast: 1 },
  hyperpop: { label: "Hyperpop", bpm: [158, 168], modes: ["major", "mixo"], color: ["#ff3df2", "#3dffe2"],
    kick: ["x..x..x...x..x..", "x..x....x.x....."], snare: ["....x.......x..."], snareKind: "snare",
    hat: ["x.x.x.x.x.x.x.x.", "x.xxx.xxx.xxx.xx"], bass: "808", pad: "supersaw", lead: "chip",
    progs: [[0, 4, 5, 3], [3, 0, 4, 5], [0, 5, 3, 4]], dens: [0.34, 0.52] },
  dnb: { label: "Drum & Bass", bpm: [172, 176], modes: ["minor", "dorian"], color: ["#29ffa0", "#0a7cff"],
    kick: ["x.........x.....", "x.x.......x....."], snare: ["....x.......x...", "....x..o.o..x..."], snareKind: "snare",
    hat: ["x.x.x.x.x.x.x.x.", "x.xxx.x.x.xxx.x."], bass: "reese", pad: "pad", lead: "saw",
    progs: [[0, 5, 6, 4], [0, 3, 5, 6], [0, 6, 5, 6]], dens: [0.26, 0.42] },
  synthwave: { label: "Synthwave", bpm: [100, 112], modes: ["minor", "dorian"], color: ["#ff5e8a", "#ffb03d"],
    kick: ["x.......x.......", "x.......x.x....."], snare: ["....x.......x..."], snareKind: "gated",
    hat: ["x.x.x.x.x.x.x.x.", "xxxxxxxxxxxxxxxx"], bass: "arp", pad: "pad", lead: "saw",
    progs: [[0, 5, 2, 6], [0, 6, 5, 6], [5, 6, 0, 0], [0, 3, 6, 5]], dens: [0.36, 0.56] },
  lofi: { label: "Lo-fi", bpm: [82, 90], modes: ["dorian", "major"], swing: 0.22, color: ["#ffc78a", "#7fa6ff"],
    kick: ["x......x..x.....", "x.........x...x."], snare: ["....x.......x..."], snareKind: "rim",
    hat: ["x.x.x.x.x.x.x.x."], bass: "walk", pad: "keys", lead: "bell", seventh: true,
    progs: [[1, 4, 0, 0], [3, 2, 1, 4], [0, 5, 1, 4], [3, 4, 2, 5]], dens: [0.28, 0.44] },
  chip: { label: "Chiptune", bpm: [138, 150], modes: ["major", "minor"], color: ["#7dff5c", "#ffd93d"],
    kick: ["x...x...x...x...", "x.....x.x......."], snare: ["....x.......x..."], snareKind: "noise",
    hat: ["x.x.x.x.x.x.x.x."], bass: "chip", pad: "arp", lead: "chip",
    progs: [[0, 3, 4, 0], [0, 5, 3, 4], [5, 3, 0, 4]], dens: [0.4, 0.58] },
  house: { label: "House", bpm: [122, 126], modes: ["minor", "dorian"], color: ["#ffe14d", "#ff4da6"],
    kick: ["x...x...x...x..."], snare: ["....x.......x..."], snareKind: "clap",
    hat: ["..x...x...x...x.", "x.x.x.x.x.x.x.x."], openHat: true, bass: "house", pad: "stab", lead: "pluck",
    progs: [[0, 0, 5, 6], [0, 3, 0, 4], [0, 6, 5, 6]], dens: [0.3, 0.46] },
  trap: { label: "Trap", bpm: [140, 146], half: true, modes: ["harm", "minor"], color: ["#b06bff", "#ff3d6e"],
    kick: ["x......x..x.....", "x.....x...x....x"], snare: ["........x......."], snareKind: "clap",
    hat: ["x.x.x.x.x.x.xxxx", "x.x.x.xxx.x.x.x."], rolls: true, bass: "808", pad: "pad", lead: "bell",
    progs: [[0, 0, 5, 4], [0, 5, 3, 4], [0, 1, 0, 4]], dens: [0.28, 0.42], fast: 1 },
  jcore: { label: "J-Core", bpm: [184, 194], modes: ["major", "minor"], color: ["#ff3d3d", "#ffe03d"],
    kick: ["x...x...x...x..."], snare: ["....x.......x..."], snareKind: "snare",
    hat: ["..x...x...x...x.", "..x.x.x...x.x.xx"], openHat: true, bass: "offbeat", pad: "supersaw", lead: "piano",
    progs: [[3, 4, 2, 5], [0, 4, 5, 3], [5, 3, 4, 0]], dens: [0.34, 0.5] },
  kawaii: { label: "Kawaii Bass", bpm: [160, 170], half: true, modes: ["major"], color: ["#ffa3e0", "#9ef5ff"],
    kick: ["x.....x...x.....", "x.........x....."], snare: ["........x......."], snareKind: "clap",
    hat: ["x.x.x.x.x.x.x.x.", "xxx.x.x.xxx.x.x."], bass: "sustain", pad: "chop", lead: "bell",
    progs: [[3, 4, 2, 5], [0, 2, 3, 4], [3, 4, 5, 0]], dens: [0.32, 0.5] },
  dubstep: { label: "Dubstep", bpm: [140, 150], half: true, modes: ["minor", "harm"], color: ["#7dfff0", "#a3ff3d"],
    kick: ["x.........x.....", "x.....x...x....."], snare: ["........x......."], snareKind: "snare",
    hat: ["x.x.x.x.x.x.x.x."], bass: "wobble", pad: "pad", lead: "saw",
    progs: [[0, 0, 5, 6], [0, 5, 6, 4], [0, 3, 5, 4]], dens: [0.26, 0.4], fast: 1 },
};

/* ---------- 収録曲（すべてこのゲームのための自作曲） ---------- */
const LIST = [
  ["edm", "Neon Sprint"], ["edm", "Starlight Overdrive"], ["edm", "Hyper Horizon"],
  ["future", "Cotton Candy Sky"], ["future", "Afterglow Letters"], ["future", "Sunset Polaroid"],
  ["hyperpop", "Glitter Glitch"], ["hyperpop", "Bubblegum Error"], ["hyperpop", "Sparkle Overload"],
  ["dnb", "Midnight Express"], ["dnb", "Liquid Lightning"], ["dnb", "Turbo Tunnel"],
  ["synthwave", "Retro Highway"], ["synthwave", "Chrome Sunset"], ["synthwave", "Night Drive 1986"],
  ["lofi", "Rainy Window"], ["lofi", "Midnight Ramen"], ["lofi", "Sleepy Cat Cafe"],
  ["chip", "Pixel Heart"], ["chip", "8-Bit Adventure"], ["chip", "Coin Rush"],
  ["house", "Rooftop Party"], ["house", "Velvet Groove"], ["house", "Shibuya 4AM"],
  ["trap", "Ice Cold Drip"], ["trap", "Shadow Boss"], ["trap", "Bass Cathedral"],
  ["jcore", "Sakura Overclock"], ["jcore", "Tokyo Speedstar"], ["jcore", "Kaleidoscope Rush"],
  ["kawaii", "Strawberry Laser"], ["kawaii", "Magical Parade"], ["kawaii", "Marshmallow Beam"],
  ["dubstep", "Robot Uprising"], ["dubstep", "Monster Wobble"], ["dubstep", "Gravity Drop"],
  ["edm", "Firework Festival"], ["future", "Polaroid Dreams"], ["hyperpop", "Emoji Overdrive"],
  ["synthwave", "Laser Grid"], ["chip", "Boss Battle 99"], ["jcore", "Hyperspeed Idol"],
];
const SONGS = LIST.map(([genre, title]) => {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const seed = hash(id), r = rngOf(seed), g = GENRES[genre];
  return { id, title, genre, seed, bpm: Math.round(g.bpm[0] + r() * (g.bpm[1] - g.bpm[0])), key: Math.floor(r() * 12) };
});

/* ---------- 作曲 ----------
   出力: events（鳴らす音を時間順に並べたもの）と steps（16分音符ごとの情報。譜面作りに使う） */
function compose(song) {
  const g = GENRES[song.genre], r = rngOf(song.seed ^ 0x9e3779b9);
  const bpm = song.bpm, step = 60 / bpm / 4, swing = (g.swing || 0) * step;
  const mode = SCALE[pick(r, g.modes)];
  const prog = pick(r, g.progs);
  const kickP = pick(r, g.kick), snareP = pick(r, g.snare), hatA = g.hat[0], hatB = pick(r, g.hat);
  const root = 48 + ((song.key + 5) % 12) - 5; // 43〜54 あたり
  const big = g.fast ?? (bpm >= 150 ? 2 : 1);
  const plan = [["intro", 4], ["verse", 8 * big], ["build", 4], ["drop", 8 * big], ["break", 4], ["build", 2], ["drop", 8 * big], ["outro", 2]];

  /* メロディの型: コードの根音からの「音階の何番目」で持つので、コードが変わっても自然に追従する */
  const near = d => { const m = ((d % 7) + 7) % 7, base = d - m; return base + [0, 0, 2, 2, 4, 4, 7][m] - (m === 6 ? 0 : 0); };
  const motif = (dens, bars, start = 0) => {
    const out = []; let d = pick(r, [0, 2, 4, 7]);
    for (let s = start; s < bars * 16; s++) {
      const strong = s % 8 === 0 ? 1 : s % 4 === 0 ? 0.85 : s % 2 === 0 ? 0.5 : 0.2;
      if (s === start || r() < dens * strong * 1.8) {
        if (s % 4 === 0) d = near(d + pick(r, [-2, 0, 2, 2, -1, 1, 3]));
        else d += pick(r, [-1, 1, 1, -1, 2, -2, 0]);
        d = clamp(d, -2, 9);
        out.push({ s, d });
      }
    }
    out.forEach((n, i) => { n.len = Math.min((out[i + 1] ? out[i + 1].s : bars * 16) - n.s, 8); });
    return out;
  };
  const phrase = dens => { // 8小節分: A A A' B（Aは2小節）
    const A = motif(dens, 2), B = motif(dens * 1.1, 2);
    const A2 = A.filter(n => n.s < 16).concat(motif(dens, 2, 16).filter(n => n.s >= 16));
    if (A2.length) A2[A2.length - 1].len = Math.max(A2[A2.length - 1].len, 4);
    const last = B[B.length - 1]; if (last) { last.d = near(last.d); last.len = Math.max(2, 32 - last.s); }
    return [A, A, A2, B];
  };
  const verseMel = phrase(g.dens[0]), dropMel = phrase(g.dens[1]);

  const events = [], steps = [];
  const ev = (t, k, o) => events.push(Object.assign({ t, k }, o));
  let bar = 0, prevBass = null;
  for (const [sec, nb] of plan) {
    for (let b = 0; b < nb; b++, bar++) {
      const cd = prog[bar % prog.length];
      const chordNotes = [0, 2, 4].concat(g.seventh ? [6] : []).map(x => root + degToSemi(mode, cd + x));
      const bassNote = root - 12 + degToSemi(mode, cd);
      const t0 = bar * 16 * step;
      const last = b === nb - 1, phraseEnd = b % 4 === 3;
      const mel = sec === "verse" || sec === "break" ? verseMel : sec === "drop" ? dropMel : null;
      const pb = Math.floor(b / 2) % 4, inB = (b % 2) * 16;

      /* 小節ごとに伸ばす音 */
      if (sec === "intro") ev(t0, "pad", { notes: chordNotes, dur: 16 * step, style: "pad", v: 0.5, cut: 500 + 400 * b });
      if (sec === "verse") ev(t0, "pad", { notes: chordNotes, dur: 16 * step, style: g.pad === "chop" || g.pad === "stab" || g.pad === "arp" ? "pad" : g.pad, v: 0.55, cut: 1400 });
      if (sec === "build") {
        ev(t0, "pad", { notes: chordNotes, dur: 16 * step, style: "supersaw", v: 0.45 + 0.1 * b, cut: 800 + 900 * (b + 1) / nb });
        if (b === 0) ev(t0, "riser", { dur: nb * 16 * step });
      }
      if (sec === "drop") ev(t0, "pad", { notes: chordNotes, dur: 16 * step, style: g.pad, v: 0.8, cut: 3200 });
      if (sec === "break") ev(t0, "pad", { notes: chordNotes, dur: 16 * step, style: "pad", v: 0.6, cut: 900 });
      if (sec === "outro" && b === 0) ev(t0, "pad", { notes: chordNotes, dur: 32 * step, style: "pad", v: 0.7, cut: 2000 });
      if (sec === "drop" && b === 0) ev(t0, "crash", {});
      if (sec === "outro" && b === 0) ev(t0, "crash", {});

      for (let s = 0; s < 16; s++) {
        const t = t0 + s * step + (s % 2 ? swing : 0);
        const st = { t, sec, bar, s, kick: 0, snare: 0, hat: 0, lead: null, crash: (sec === "drop" || sec === "outro") && b === 0 && s === 0 };
        const drums = sec === "verse" || sec === "drop";
        const fill = drums && phraseEnd && s >= 12 && (sec === "drop" || last);

        /* ドラム */
        if ((drums || (sec === "intro" && b >= nb / 2)) && kickP[s] !== "." && !(fill && s > 12)) st.kick = 1;
        if (sec === "outro" && s === 0 && b === 0) st.kick = 1;
        if (sec === "build" && !(last && s >= 8) && s % 4 === 0 && b < nb - 1) st.kick = 0.8;
        if (drums && snareP[s] !== ".") st.snare = snareP[s] === "x" ? 1 : 0.4;
        if (fill && (s === 13 || s === 14 || s === 15 || (sec === "drop" && s === 12))) st.snare = 0.8;
        if (sec === "build") { // だんだん細かくなるスネアロール
          const p = (b + s / 16) / nb, iv = p < 0.5 ? 4 : p < 0.75 ? 2 : 1;
          if (s % iv === 0) st.snare = 0.35 + 0.6 * p;
        }
        const hp = sec === "drop" ? hatB : hatA;
        if ((drums || sec === "intro") && hp[s] !== ".") st.hat = sec === "intro" ? 0.5 : 1;
        if (g.rolls && sec === "drop" && s >= 12 && b % 2 === 1) st.hat = 1, st.roll = true;

        if (st.kick) ev(t, "kick", { v: st.kick, duck: sec !== "intro" });
        if (st.snare) ev(t, g.snareKind === "gated" && st.snare >= 1 ? "gated" : sec === "build" ? "snare" : g.snareKind, { v: st.snare });
        if (st.hat) {
          if (st.roll) { ev(t, "hat", { v: 0.6 }); ev(t + step / 2, "hat", { v: 0.5 }); }
          else ev(t, "hat", { v: (s % 4 === 2 ? 1 : 0.6) * st.hat, open: g.openHat && s % 4 === 2 && sec === "drop" });
        }

        /* ベース */
        const bassOn = sec === "verse" || sec === "drop" || (sec === "build" && !last);
        if (bassOn) {
          const n = bassNote, dur = k => k * step;
          switch (sec === "build" ? "sustainBuild" : g.bass) {
            case "offbeat": if (s % 4 === 2) ev(t, "bass", { n, dur: dur(2), style: "pluck" }); break;
            case "house": if (s % 4 === 2) ev(t, "bass", { n: n + (s === 14 ? 12 : 0), dur: dur(1.6), style: "pluck" }); break;
            case "arp": if (s % 2 === 0) ev(t, "bass", { n: n + (s % 4 === 2 ? 12 : 0), dur: dur(1.8), style: "pluck" }); break;
            case "chip": if (s % 2 === 0) ev(t, "bass", { n: n + [0, 12, 7, 12][(s / 2) % 4], dur: dur(1.8), style: "tri" }); break;
            case "walk": if (s === 0 || s === 8 || s === 14) ev(t, "bass", { n: s === 8 ? n + 7 : s === 14 ? n + degToSemi(mode, 6) - 12 + 12 : n, dur: dur(s === 14 ? 2 : 6), style: "round" }); break;
            case "reese": if (s === 0 || s === 8) ev(t, "bass", { n, dur: dur(8), style: "reese" }); break;
            case "sustain": if (s === 0) ev(t, "bass", { n, dur: dur(14), style: "sub" }); break;
            case "808": if (st.kick) { ev(t, "bass", { n, dur: dur(kickP.indexOf("x", s + 1) > 0 ? kickP.indexOf("x", s + 1) - s : 16 - s), style: "808", from: prevBass }); prevBass = n; } break;
            case "wobble": if (sec === "drop") { if (s % 4 === 0) ev(t, "bass", { n, dur: dur(4), style: "wobble", rate: pick(r, [2, 4, 4, 8]) }); }
              else if (s === 0) ev(t, "bass", { n, dur: dur(14), style: "sub" }); break;
            case "sustainBuild": if (s % 8 === 0) ev(t, "bass", { n, dur: dur(7), style: "sub" }); break;
          }
        }

        /* 和音のきざみ（ドロップ） */
        if (sec === "drop") {
          if (g.pad === "chop" && "x..x..x...x.x..."[s] === "x") st.chord = 1, ev(t, "chord", { notes: chordNotes.map(x => x + 12), dur: 2 * step, style: "chop" });
          if (g.pad === "stab" && s % 4 === 2) st.chord = 1, ev(t, "chord", { notes: chordNotes.map(x => x + 12), dur: 1.4 * step, style: "stab" });
          if (g.pad === "arp") ev(t, "chord", { notes: [chordNotes[(s % 3)] + 12 + (s % 6 >= 3 ? 12 : 0)], dur: 1 * step, style: "arp" });
        }

        /* メロディ */
        if (mel) {
          const m = mel[pb].find(n => n.s === inB + s);
          if (m) {
            const oct = sec === "break" ? 12 : 24;
            const n = root + oct + degToSemi(mode, cd + m.d);
            const len = m.len * step * (sec === "break" ? 1 : 0.92);
            ev(t, "lead", { n, dur: len, style: sec === "break" ? "bell" : g.lead, v: sec === "break" ? 0.6 : 0.9 });
            st.lead = { n, len: m.len };
          }
        }
        steps.push(st);
      }
    }
  }
  events.sort((a, b) => a.t - b.t);
  const dur = bar * 16 * step;
  return { song, g, bpm, step, events, steps, dur, preview: plan.slice(0, 3).reduce((a, [, n]) => a + n, 0) * 16 * step };
}

/* ---------- 譜面 ---------- */
const DIFFS = ["easy", "normal", "hard", "oni"];
const DSPEC = {
  easy:   { grid: 4, gap: 0.46, hold: 8, dbl: 0,    hats: false, drums: 0.5 },
  normal: { grid: 2, gap: 0.25, hold: 6, dbl: 0.06, hats: false, drums: 0.8 },
  hard:   { grid: 1, gap: 0.15, hold: 4, dbl: 0.18, hats: false, drums: 1 },
  oni:    { grid: 1, gap: 0.075, hold: 4, dbl: 0.32, hats: true, drums: 1 },
};
function chart(data, diff) {
  const D = DSPEC[diff], r = rngOf(data.song.seed + DIFFS.indexOf(diff) * 7919);
  const notes = [];
  let lastT = -9, lane = 1, prevPitch = null, holdUntil = [-9, -9, -9, -9], dir = 1;
  const free = (l, t) => holdUntil[l] < t - 0.05;
  const pickLane = (t, want) => {
    if (free(want, t)) return want;
    for (const d of [1, -1, 2, -2, 3, -3]) { const l = want + d; if (l >= 0 && l < 4 && free(l, t)) return l; }
    return -1;
  };
  for (const st of data.steps) {
    if (st.s % D.grid) continue;
    const t = st.t, gap = t - lastT;
    let src = null;
    if (st.lead) src = "lead";
    else if (st.snare >= 0.8 || (st.snare && diff !== "easy" && st.sec === "build")) src = "snare";
    else if (st.kick && r() < D.drums) src = "kick";
    else if (st.chord && diff !== "easy") src = "chord";
    else if (st.snare && diff !== "easy") src = "snare";
    else if (D.hats && st.hat && st.sec === "drop") src = "hat";
    if (!src) continue;
    const minGap = src === "lead" ? D.gap : D.gap * (diff === "oni" ? 1 : 1.3);
    if (gap < minGap - 1e-6) continue;
    // 低い難易度では、伸ばしている間は次を置かない
    if ((diff === "easy" || diff === "normal") && Math.max(...holdUntil) > t - D.gap) continue;
    if (st.sec === "build" && diff === "easy" && st.s % 8) continue;

    let want;
    if (src === "lead") {
      const p = st.lead.n;
      if (prevPitch === null) want = 1;
      else if (p > prevPitch) want = lane + (p - prevPitch > 4 && diff !== "easy" ? 2 : 1);
      else if (p < prevPitch) want = lane - (prevPitch - p > 4 && diff !== "easy" ? 2 : 1);
      else want = (diff === "hard" || diff === "oni") && gap > 0.2 ? lane : lane + dir;
      prevPitch = p;
    } else if (src === "kick") want = lane <= 1 ? 3 - (st.bar % 2) : st.bar % 2;
    else if (src === "hat") want = lane + dir;
    else want = lane + dir * (r() < 0.5 ? 1 : 2);
    if (want > 3) { want = 6 - want; dir = -1; }
    if (want < 0) { want = -want; dir = 1; }
    want = clamp(want, 0, 3);
    if (want === lane && gap < 0.3 && diff !== "oni") want = clamp(lane + dir, 0, 3) === lane ? lane - dir : lane + dir;
    const l = pickLane(t, want);
    if (l < 0) continue;

    let len = 0;
    if (src === "lead" && st.lead.len >= D.hold) len = st.lead.len * data.step * 0.85;
    notes.push({ t, lane: l, len });
    if (len) holdUntil[l] = t + len;
    lane = l; lastT = t;

    // 同時押し: 盛り上がる場所（ドロップの頭・強いキック）
    const strong = st.crash || (st.sec === "drop" && st.kick && st.s % 8 === 0);
    if (D.dbl && strong && (st.crash || r() < D.dbl * 2.2)) {
      const other = [3 - l, l < 2 ? l + 2 : l - 2].find(x => free(x, t) && x !== l);
      if (other !== undefined) notes.push({ t, lane: other, len: 0 });
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  // レベル: 1秒あたりのノーツ数と同時押し・ロングノーツから
  const span = Math.max(20, (notes.length ? notes[notes.length - 1].t - notes[0].t : 1));
  const nps = notes.length / span, holds = notes.filter(n => n.len).length / Math.max(1, notes.length);
  const level = clamp(Math.round(nps * 1.55 + holds * 2 + (diff === "oni" ? 1.5 : diff === "hard" ? 0.7 : 0)), 1, 15);
  return { notes, level, nps };
}

/* ---------- 音 ----------
   1回の再生ごとに Engine を作る。止めるときは出力をつなぎ替えて捨てる */
let NOISE = null, IR = null, DRIVE = null;
function shared(ctx) {
  if (NOISE && NOISE.sampleRate === ctx.sampleRate) return;
  const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  NOISE = n;
  const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  IR = ir;
  DRIVE = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; DRIVE[i] = Math.tanh(x * 2.6); }
}

function Engine(ctx, dest, data) {
  shared(ctx);
  const spb = 60 / data.bpm;
  const out = ctx.createGain(); out.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.15;
  const post = ctx.createGain(); post.gain.value = 0.72; // コンプレッサーの自動補正で音が割れないように下げる
  out.connect(comp).connect(post).connect(dest);
  const bus = v => { const g = ctx.createGain(); g.gain.value = v; g.connect(out); return g; };
  const drum = bus(0.9), duck = bus(1), lead = bus(0.55);
  const rev = ctx.createConvolver(); rev.buffer = IR; const revOut = bus(0.32); rev.connect(revOut);
  const dly = ctx.createDelay(2); dly.delayTime.value = spb * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.32; const dlf = ctx.createBiquadFilter(); dlf.type = "lowpass"; dlf.frequency.value = 2600;
  dly.connect(dlf).connect(fb).connect(dly); const dlyOut = bus(0.3); dlf.connect(dlyOut);
  const music = ctx.createGain(); music.gain.value = 0.5; music.connect(duck);

  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const send = (node, r = 0, d = 0) => { if (r) { const g = gain(r); node.connect(g); g.connect(rev); } if (d) { const g = gain(d); node.connect(g); g.connect(dly); } };
  const adsr = (g, t, a, d, s, rel, dur, peak) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, d); g.gain.setTargetAtTime(0.0001, t + Math.max(dur, a), rel);
    return t + Math.max(dur, a) + rel * 6;
  };
  const osc = (type, f, t, end, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det; o.start(t); o.stop(end); return o; };
  const noise = (t, end) => { const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(end); return s; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const pump = t => { // キックに合わせて伴奏を一瞬下げる（サイドチェイン）
    duck.gain.setTargetAtTime(0.35, t, 0.004); duck.gain.setTargetAtTime(1, t + 0.04, 0.07);
  };

  const P = {
    kick(t, e) {
      const o = osc("sine", 150, t, t + 0.5), g = gain();
      o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      g.gain.setValueAtTime(1.05 * e.v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.connect(g).connect(drum);
      const n = noise(t, t + 0.02), ng = gain(0.25 * e.v), hp = filt("highpass", 3000);
      n.connect(hp).connect(ng).connect(drum);
      if (e.duck) pump(t);
    },
    snare(t, e) {
      const n = noise(t, t + 0.3), bp = filt("bandpass", 2200, 0.8), g = gain();
      g.gain.setValueAtTime(0.55 * e.v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      n.connect(bp).connect(g).connect(drum); send(g, 0.25);
      const o = osc("triangle", 190, t, t + 0.15), og = gain();
      o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      og.gain.setValueAtTime(0.45 * e.v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og).connect(drum);
    },
    clap(t, e) {
      const n = noise(t, t + 0.4), bp = filt("bandpass", 1300, 1.2), g = gain();
      g.gain.setValueAtTime(0.0001, t);
      for (const k of [0, 0.011, 0.022]) { g.gain.setValueAtTime(0.7 * e.v, t + k); g.gain.exponentialRampToValueAtTime(0.08 * e.v, t + k + 0.009); }
      g.gain.setValueAtTime(0.5 * e.v, t + 0.033); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      n.connect(bp).connect(g).connect(drum); send(g, 0.35);
    },
    gated(t, e) { // 80年代風の大きいスネア
      const n = noise(t, t + 0.4), bp = filt("bandpass", 1500, 0.6), g = gain();
      g.gain.setValueAtTime(0.6 * e.v, t); g.gain.setValueAtTime(0.45 * e.v, t + 0.18); g.gain.linearRampToValueAtTime(0.0001, t + 0.24);
      n.connect(bp).connect(g).connect(drum); send(g, 0.6);
      P.snare(t, { v: 0.5 * e.v });
    },
    rim(t, e) {
      const o = osc("square", 1650, t, t + 0.05), bp = filt("bandpass", 1700, 3), g = gain();
      g.gain.setValueAtTime(0.35 * e.v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(bp).connect(g).connect(drum); send(g, 0.3);
      const n = noise(t, t + 0.1), ng = gain(), hp = filt("bandpass", 3000, 0.7);
      ng.gain.setValueAtTime(0.18 * e.v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      n.connect(hp).connect(ng).connect(drum);
    },
    noise(t, e) {
      const n = noise(t, t + 0.2), g = gain(), lp = filt("lowpass", 6000);
      g.gain.setValueAtTime(0.5 * e.v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      n.connect(lp).connect(g).connect(drum);
    },
    hat(t, e) {
      const len = e.open ? 0.22 : 0.045, n = noise(t, t + len + 0.05), hp = filt("highpass", 7500), g = gain();
      g.gain.setValueAtTime(0.2 * e.v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      n.connect(hp).connect(g).connect(drum);
    },
    crash(t) {
      const n = noise(t, t + 2.2), hp = filt("highpass", 4200), g = gain();
      g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2);
      n.connect(hp).connect(g).connect(drum); send(g, 0.4);
    },
    riser(t, e) {
      const n = noise(t, t + e.dur), bp = filt("bandpass", 400, 2.5), g = gain();
      bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + e.dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + e.dur * 0.98); g.gain.linearRampToValueAtTime(0, t + e.dur);
      n.connect(bp).connect(g).connect(out); send(g, 0.3);
    },
    bass(t, e) {
      const f = mtof(e.n), end = t + e.dur + 0.3, g = gain();
      if (e.style === "808") {
        const o = osc("sine", e.from != null && e.from !== e.n ? mtof(e.from) : f, t, end), sh = ctx.createWaveShaper(); sh.curve = DRIVE;
        o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
        adsr(g, t, 0.005, 0.5, 0.6, 0.08, e.dur, 0.75);
        const pre = gain(1.4); o.connect(pre).connect(sh).connect(g).connect(duck);
        return;
      }
      if (e.style === "sub") {
        const o = osc("sine", f, t, end); adsr(g, t, 0.02, 0.5, 0.85, 0.1, e.dur, 0.6); o.connect(g).connect(duck); return;
      }
      if (e.style === "tri") {
        const o = osc("triangle", f * 2, t, end); adsr(g, t, 0.003, 0.08, 0.7, 0.03, e.dur, 0.55); o.connect(g).connect(duck); return;
      }
      if (e.style === "round") {
        const o = osc("triangle", f, t, end), o2 = osc("sine", f, t, end); adsr(g, t, 0.01, 0.4, 0.5, 0.08, e.dur, 0.5);
        o.connect(g); o2.connect(g); g.connect(duck); return;
      }
      if (e.style === "reese") {
        const lp = filt("lowpass", 520, 2), o1 = osc("sawtooth", f, t, end, -14), o2 = osc("sawtooth", f, t, end, 14), s = osc("sine", f, t, end);
        lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(900, t + e.dur * 0.6); lp.frequency.linearRampToValueAtTime(420, t + e.dur);
        adsr(g, t, 0.01, 0.3, 0.9, 0.05, e.dur, 0.32);
        o1.connect(lp); o2.connect(lp); lp.connect(g); const sg = gain(0.6); s.connect(sg).connect(g); g.connect(duck); return;
      }
      if (e.style === "wobble") {
        const lp = filt("lowpass", 300, 6), o1 = osc("sawtooth", f, t, end, -8), o2 = osc("square", f / 2, t, end, 6);
        const per = e.dur / e.rate; lp.frequency.setValueAtTime(220, t);
        for (let i = 0; i < e.rate; i++) { lp.frequency.linearRampToValueAtTime(2600, t + per * (i + 0.5)); lp.frequency.linearRampToValueAtTime(240, t + per * (i + 1)); }
        adsr(g, t, 0.005, 0.2, 0.9, 0.03, e.dur, 0.42);
        const sh = ctx.createWaveShaper(); sh.curve = DRIVE;
        o1.connect(lp); o2.connect(lp); lp.connect(sh).connect(g).connect(duck);
        const s = osc("sine", f, t, end), sg = gain(); adsr(sg, t, 0.005, 0.2, 0.9, 0.03, e.dur, 0.4); s.connect(sg).connect(duck);
        return;
      }
      // pluck
      const lp = filt("lowpass", 300, 4), o = osc("sawtooth", f, t, end), s = osc("sine", f, t, end);
      lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.16);
      adsr(g, t, 0.003, 0.12, 0.55, 0.04, e.dur, 0.5);
      o.connect(lp).connect(g); const sg = gain(0.55); s.connect(sg).connect(g); g.connect(duck);
    },
    pad(t, e) { P.chord(t, e); },
    chord(t, e) {
      const end = t + e.dur + 1.2, g = gain();
      let lp;
      switch (e.style) {
        case "supersaw":
          lp = filt("lowpass", e.cut || 3000, 0.8);
          for (const n of e.notes) for (const d of [-14, 14]) osc("sawtooth", mtof(n), t, t + e.dur + 0.8, d).connect(lp);
          adsr(g, t, 0.02, 0.4, 0.85, 0.12, e.dur, 0.085 * (e.v || 1)); lp.connect(g).connect(music); send(g, 0.45); return;
        case "pad":
          lp = filt("lowpass", e.cut || 1500, 0.6);
          for (const n of e.notes) for (const d of [-9, 9]) osc("sawtooth", mtof(n), t, end, d).connect(lp);
          adsr(g, t, 0.25, 0.8, 0.85, 0.35, e.dur, 0.06 * (e.v || 1)); lp.connect(g).connect(music); send(g, 0.6); return;
        case "keys": // ローファイのエレピ
          for (const [k, n] of e.notes.entries()) {
            for (const tt of [t, t + e.dur * 0.625]) {
              const gg = gain(), o = osc("sine", mtof(n), tt + k * 0.012, tt + 1.6), o2 = osc("triangle", mtof(n) * 2, tt + k * 0.012, tt + 0.4), g2 = gain(0.12);
              adsr(gg, tt + k * 0.012, 0.005, 0.5, 0.3, 0.3, e.dur * 0.5, 0.12 * (e.v || 1));
              o.connect(gg); o2.connect(g2).connect(gg); gg.connect(music); send(gg, 0.5);
            }
          }
          return;
        case "chop": {
          lp = filt("lowpass", 4200, 0.7);
          for (const n of e.notes) for (const d of [-12, 12]) osc("sawtooth", mtof(n), t, t + e.dur + 0.3, d).connect(lp);
          adsr(g, t, 0.004, 0.08, 0.6, 0.04, e.dur, 0.09); lp.connect(g).connect(music); send(g, 0.4, 0.15); return;
        }
        case "stab": {
          lp = filt("lowpass", 2400, 1.5);
          for (const n of e.notes) { osc("square", mtof(n), t, t + e.dur + 0.3, -5).connect(lp); osc("sawtooth", mtof(n), t, t + e.dur + 0.3, 5).connect(lp); }
          adsr(g, t, 0.003, 0.06, 0.4, 0.04, e.dur, 0.07); lp.connect(g).connect(music); send(g, 0.4, 0.2); return;
        }
        case "arp": {
          const o = osc("square", mtof(e.notes[0]), t, t + e.dur + 0.2); adsr(g, t, 0.002, 0.05, 0.4, 0.02, e.dur, 0.08); o.connect(g).connect(music); send(g, 0, 0.25); return;
        }
      }
    },
    lead(t, e) {
      const f = mtof(e.n), end = t + e.dur + 0.8, g = gain(), v = e.v || 1;
      switch (e.style) {
        case "saw": {
          const lp = filt("lowpass", 3800, 1), o1 = osc("sawtooth", f, t, end, -7), o2 = osc("sawtooth", f, t, end, 7);
          const vib = osc("sine", 5.5, t, end), vg = gain(0); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(e.dur > 0.3 ? 14 : 0, t + Math.min(0.4, e.dur));
          vib.connect(vg); vg.connect(o1.detune); vg.connect(o2.detune);
          adsr(g, t, 0.008, 0.2, 0.75, 0.08, e.dur, 0.2 * v); o1.connect(lp); o2.connect(lp); lp.connect(g).connect(lead); send(g, 0.3, 0.35); return;
        }
        case "chip": {
          const o = osc("square", f, t, end), o2 = osc("square", f * 2, t, end, 3), g2 = gain(0.25);
          adsr(g, t, 0.002, 0.1, 0.65, 0.03, e.dur, 0.16 * v); o.connect(g); o2.connect(g2).connect(g); g.connect(lead); send(g, 0.15, 0.3); return;
        }
        case "pluck": {
          const lp = filt("lowpass", 400, 3), o1 = osc("sawtooth", f, t, end, -10), o2 = osc("sawtooth", f, t, end, 10);
          lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.25);
          adsr(g, t, 0.003, 0.18, 0.35, 0.1, e.dur, 0.26 * v); o1.connect(lp); o2.connect(lp); lp.connect(g).connect(lead); send(g, 0.4, 0.4); return;
        }
        case "piano": {
          const o = osc("triangle", f, t, end), o2 = osc("sine", f * 2, t, end), o3 = osc("sawtooth", f, t, t + 0.08), g2 = gain(0.3), g3 = gain();
          g3.gain.setValueAtTime(0.06, t); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          adsr(g, t, 0.002, 0.35, 0.25, 0.15, e.dur, 0.3 * v); o.connect(g); o2.connect(g2).connect(g); o3.connect(g3).connect(g); g.connect(lead); send(g, 0.3, 0.25); return;
        }
        default: { // bell (FM)
          const o = osc("sine", f, t, end), m = osc("sine", f * 3.5, t, end), mg = gain();
          mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
          m.connect(mg).connect(o.frequency);
          adsr(g, t, 0.003, 0.45, 0.3, 0.25, e.dur, 0.24 * v); o.connect(g).connect(lead); send(g, 0.5, 0.35);
        }
      }
    },
  };

  return {
    out,
    play(e, at) { const f = P[e.k]; if (f) f(at, e); },
    stop(at) {
      out.gain.setTargetAtTime(0, at, 0.05);
      setTimeout(() => { try { out.disconnect(); post.disconnect(); } catch (x) {} }, 400);
    },
  };
}

/* 先読みスケジューラー: 0.15秒先までの音を正確な時刻で予約する（ゲームの判定もこの時刻を使う） */
function Player(ctx, dest, data, { offset = 0, loopTo = null, lead = 0.12 } = {}) {
  const eng = Engine(ctx, dest, data);
  const t0 = ctx.currentTime + lead - offset;
  let i = data.events.findIndex(e => e.t >= offset - 0.001); if (i < 0) i = data.events.length;
  let base = t0, stopped = false;
  const end = loopTo ? loopTo : data.dur;
  const tick = () => {
    if (stopped) return;
    const horizon = ctx.currentTime + 0.16;
    while (true) {
      if (i >= data.events.length || data.events[i].t >= end) {
        if (!loopTo) break;
        base += end - offset; i = data.events.findIndex(e => e.t >= offset - 0.001);
        continue;
      }
      const e = data.events[i], at = base + e.t;
      if (at > horizon) break;
      if (at > ctx.currentTime - 0.05) eng.play(e, Math.max(at, ctx.currentTime));
      i++;
    }
  };
  tick();
  const timer = setInterval(tick, 25);
  return {
    startTime: t0,
    get done() { return !loopTo && i >= data.events.length; },
    tick,
    stop(fade = true) { if (stopped) return; stopped = true; clearInterval(timer); eng.stop(ctx.currentTime + (fade ? 0 : 0)); },
  };
}

const cache = new Map();
const get = id => { if (!cache.has(id)) cache.set(id, compose(SONGS.find(s => s.id === id))); return cache.get(id); };
const charts = new Map();
const chartOf = (id, diff) => { const k = id + "/" + diff; if (!charts.has(k)) charts.set(k, chart(get(id), diff)); return charts.get(k); };

return { SONGS, GENRES, DIFFS, get, chartOf, Player, Engine, rngOf, hash };
})();
