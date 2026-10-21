/* Pulse Rush 本体: 画面の切り替え、プレイ（判定・描画）、記録の保存、結果画面 */
(window.PLATFORM && window.PLATFORM.init ? window.PLATFORM.init() : Promise.resolve()).then(() => {
"use strict";
const M = window.Music, PF = window.PLATFORM || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const Q = new URLSearchParams(location.search);
const AUTO = Q.has("auto"); // 自動演奏（宣伝動画の撮影用）

/* ---------- 言語 ---------- */
const LANG = (() => {
  const q = Q.get("lang"); if (q) return q === "ja" ? "ja" : "en";
  try { const s = localStorage.getItem("lang"); if (s) return s; } catch (e) {}
  if (PF.lang) return PF.lang;
  return /^ja\b/i.test(navigator.language || "") ? "ja" : "en";
})();
const EN = LANG !== "ja";
const tr = (ja, en) => EN ? en : ja;
document.documentElement.lang = EN ? "en" : "ja";
$$("[data-en]").forEach(el => { if (EN) el.innerHTML = el.dataset.en; });

/* ---------- 保存 ---------- */
const KEY = "pulserush.v1";
const save = (() => {
  let d = null;
  try { d = JSON.parse((PF.storage || localStorage).getItem(KEY) || "null"); } catch (e) {}
  d = Object.assign({ best: {}, speed: 5, offset: 0, music: 0.8, se: 0.6, hitsound: true, diff: "normal", song: null, plays: 0, tut: false }, d || {});
  return d;
})();
const persist = () => { try { (PF.storage || localStorage).setItem(KEY, JSON.stringify(save)); } catch (e) {} };

/* ---------- 定数 ---------- */
const DIFF_LABEL = { easy: tr("簡単", "Easy"), normal: tr("普通", "Normal"), hard: tr("難しい", "Hard"), oni: tr("鬼", "Oni") };
const DIFF_COLOR = { easy: "#3dffa0", normal: "#3dc8ff", hard: "#ffb03d", oni: "#ff3d7f" };
const LANE_COLOR = ["#ff4fd8", "#4fe6ff", "#4fe6ff", "#ff4fd8"];
const WIN = { perfect: 0.045, great: 0.09, good: 0.13 };
const JW = { perfect: 1, great: 0.7, good: 0.35, miss: 0 };
const JLABEL = { perfect: "PERFECT", great: "GREAT", good: "GOOD", miss: "MISS" };
const JCOLOR = { perfect: "#fff27a", great: "#5ef0ff", good: "#9dffb0", miss: "#ff5a7a" };
const rankOf = s => s >= 990000 ? "SSS" : s >= 970000 ? "SS" : s >= 940000 ? "S" : s >= 880000 ? "A" : s >= 800000 ? "B" : s >= 700000 ? "C" : "D";
const RANK_COLOR = { SSS: "#fff27a", SS: "#ffd76a", S: "#ffb03d", A: "#ff6ad5", B: "#5ef0ff", C: "#9dffb0", D: "#a9a3c9" };
const DAILY = M.SONGS[Math.floor(Date.now() / 864e5) % M.SONGS.length].id;

/* ---------- 音 ---------- */
let AC = null, MASTER = null, MUSIC = null, SE = null, preview = null, previewId = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    MASTER = AC.createGain(); MASTER.connect(AC.destination);
    MUSIC = AC.createGain(); MUSIC.connect(MASTER);
    SE = AC.createGain(); SE.connect(MASTER);
    applyVolume();
  }
  if (AC.state === "suspended" && !paused && !PF.adPlaying) AC.resume();
  return AC;
}
function applyVolume() { if (MUSIC) { MUSIC.gain.value = save.music; SE.gain.value = save.se; } }
PF.onPause = () => { if (AC) AC.suspend(); };
PF.onResume = () => { if (AC && !paused) AC.resume(); };
function blip(f = 1400, v = 0.25, d = 0.05, type = "triangle") {
  if (!AC || !save.hitsound) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(SE); o.start(t); o.stop(t + d + 0.02);
}
const ui = (f = 880) => { if (AC) blip(f, 0.12, 0.06, "sine"); };
function stopPreview() { if (preview) { preview.stop(); preview = null; previewId = null; } }
function playPreview(id) {
  if (!AC || previewId === id || PF.adPlaying) return;
  stopPreview();
  const d = M.get(id);
  previewId = id;
  preview = M.Player(AC, MUSIC, d, { offset: d.preview, loopTo: d.preview + Math.min(16 * 16 * d.step, 24), lead: 0.25 });
  preview.data = d;
}

/* ---------- ジャケット絵（曲ごとに自動で描く） ---------- */
const jackets = new Map();
function jacket(song, size = 160) {
  const k = song.id + size; if (jackets.has(k)) return jackets.get(k);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"), r = M.rngOf(song.seed), [c1, c2] = M.GENRES[song.genre].color, S = size;
  const g = x.createLinearGradient(0, 0, S * r(), S); g.addColorStop(0, "#0b0820"); g.addColorStop(1, c2 + "aa");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = "lighter";
  const type = Math.floor(r() * 4);
  x.lineWidth = S * 0.025; x.strokeStyle = c1; x.fillStyle = c1;
  if (type === 0) { for (let i = 0; i < 6; i++) { x.globalAlpha = 0.9 - i * 0.13; x.beginPath(); x.arc(S * (0.3 + r() * 0.4), S * (0.3 + r() * 0.4), S * (0.08 + i * 0.07), 0, 7); x.stroke(); } }
  else if (type === 1) { const cy = S * 0.62; x.globalAlpha = 0.95; const sg = x.createLinearGradient(0, cy - S * 0.3, 0, cy); sg.addColorStop(0, "#fff27a"); sg.addColorStop(1, c1); x.fillStyle = sg; x.beginPath(); x.arc(S / 2, cy, S * 0.28, Math.PI, 0); x.fill(); x.globalAlpha = 1; x.fillStyle = "#0b0820"; for (let i = 0; i < 5; i++) x.fillRect(0, cy - S * 0.03 * (i + 1) * 1.6, S, S * 0.012 * (i + 1)); x.strokeStyle = c2; x.globalAlpha = 0.8; x.lineWidth = S * 0.01; for (let i = 0; i < 8; i++) { const yy = cy + (S - cy) * Math.pow(i / 8, 1.6); x.beginPath(); x.moveTo(0, yy); x.lineTo(S, yy); x.stroke(); } for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(S / 2 + i * S * 0.03, cy); x.lineTo(S / 2 + i * S * 0.2, S); x.stroke(); } }
  else if (type === 2) { for (let i = 0; i < 9; i++) { x.globalAlpha = 0.25 + r() * 0.6; x.save(); x.translate(S * r(), S * r()); x.rotate(r() * 6); const z = S * (0.08 + r() * 0.22); x.beginPath(); x.moveTo(0, -z); x.lineTo(z * 0.87, z / 2); x.lineTo(-z * 0.87, z / 2); x.closePath(); r() < 0.5 ? x.fill() : x.stroke(); x.restore(); } }
  else { x.globalAlpha = 0.85; const n = 10 + Math.floor(r() * 10); for (let i = 0; i < n; i++) { const h = S * (0.1 + r() * 0.75); x.fillStyle = i % 2 ? c1 : c2; x.fillRect(i * S / n + S * 0.01, S - h, S / n - S * 0.02, h); } }
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  const v = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75); v.addColorStop(0, "transparent"); v.addColorStop(1, "rgba(0,0,0,.55)");
  x.fillStyle = v; x.fillRect(0, 0, S, S);
  const url = c.toDataURL(); jackets.set(k, url); return url;
}

/* ---------- 画面 ---------- */
let screen = "title";
function show(id) {
  screen = id;
  $$(".screen").forEach(s => s.hidden = s.id !== "s-" + id);
  document.body.dataset.screen = id;
}

/* タイトル */
$("#start").addEventListener("click", () => { audio(); ui(1200); openSelect(); });

/* ---------- 曲選択 ---------- */
let genreFilter = "all", selId = save.song && M.SONGS.some(s => s.id === save.song) ? save.song : DAILY, diff = save.diff;
function bestOf(id, d) { return save.best[id + "/" + d]; }
function buildChips() {
  const gs = ["all", ...Object.keys(M.GENRES)];
  $("#chips").innerHTML = gs.map(g => `<button type="button" class="chip${g === genreFilter ? " on" : ""}" data-g="${g}">${g === "all" ? tr("すべて", "All") + ` <small>${M.SONGS.length}</small>` : esc(M.GENRES[g].label)}</button>`).join("");
}
function buildList() {
  const list = M.SONGS.filter(s => genreFilter === "all" || s.genre === genreFilter);
  $("#songs").innerHTML = list.map(s => {
    const b = bestOf(s.id, diff), g = M.GENRES[s.genre];
    return `<button type="button" class="song${s.id === selId ? " sel" : ""}" data-id="${s.id}" style="--c1:${g.color[0]};--c2:${g.color[1]}">
      <img alt="" src="${jacket(s, 112)}" width="56" height="56">
      <span class="meta"><b>${esc(s.title)}</b><small>${esc(g.label)} · ${s.bpm} BPM${s.id === DAILY ? ` · <em>${tr("今日のおすすめ", "Today's pick")}</em>` : ""}</small></span>
      <span class="lv" style="--dc:${DIFF_COLOR[diff]}">${b ? `<i class="rk" style="color:${RANK_COLOR[b.rank]}">${b.rank}</i>` : ""}<span>Lv.${M.chartOf(s.id, diff).level}</span></span>
    </button>`;
  }).join("");
}
function buildDetail() {
  const s = M.SONGS.find(x => x.id === selId), g = M.GENRES[s.genre];
  $("#d-jacket").src = jacket(s, 240);
  $("#d-title").textContent = s.title;
  $("#d-sub").textContent = `${g.label} · ${s.bpm} BPM · ${fmtTime(M.get(s.id).dur)}`;
  $("#diffs").innerHTML = M.DIFFS.map(d => {
    const c = M.chartOf(s.id, d), b = bestOf(s.id, d);
    return `<button type="button" class="diff${d === diff ? " on" : ""}" data-d="${d}" style="--dc:${DIFF_COLOR[d]}"><span>${DIFF_LABEL[d]}</span><b>${c.level}</b>${b ? `<i style="color:${RANK_COLOR[b.rank]}">${b.rank}${b.fc ? "★" : ""}</i>` : "<i>-</i>"}</button>`;
  }).join("");
  const b = bestOf(s.id, diff);
  $("#d-best").innerHTML = b ? `${tr("ベスト", "Best")} <b>${b.score.toLocaleString()}</b> · ${b.ap ? "ALL PERFECT" : b.fc ? "FULL COMBO" : tr("最大コンボ ", "Max combo ") + b.combo}` : tr("まだ遊んでいません", "Not played yet");
  document.documentElement.style.setProperty("--g1", g.color[0]);
  document.documentElement.style.setProperty("--g2", g.color[1]);
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
function select(id, scroll) {
  selId = id; save.song = id; persist();
  $$("#songs .song").forEach(b => b.classList.toggle("sel", b.dataset.id === id));
  buildDetail();
  playPreview(id);
  if (scroll) { const el = $(`#songs .song[data-id="${id}"]`); el && el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
}
function openSelect() {
  show("select"); buildChips(); buildList(); select(selId, true);
}
$("#chips").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  genreFilter = b.dataset.g; ui(); buildChips(); buildList();
  const first = M.SONGS.find(s => genreFilter === "all" || s.genre === genreFilter);
  if (!M.SONGS.some(s => s.id === selId && (genreFilter === "all" || s.genre === genreFilter))) select(first.id); else select(selId);
  $("#songs").scrollTop = 0;
});
$("#songs").addEventListener("click", e => {
  const b = e.target.closest(".song"); if (!b) return;
  if (b.dataset.id === selId && matchMedia("(pointer:coarse)").matches === false) return startGame();
  ui(1000); select(b.dataset.id);
});
$("#diffs").addEventListener("click", e => {
  const b = e.target.closest(".diff"); if (!b) return;
  diff = b.dataset.d; save.diff = diff; persist(); ui(700 + M.DIFFS.indexOf(diff) * 150); buildList(); buildDetail();
});
$("#play").addEventListener("click", () => startGame());
$("#random").addEventListener("click", () => {
  const pool = M.SONGS.filter(s => genreFilter === "all" || s.genre === genreFilter);
  ui(1300); select(pool[Math.floor(Math.random() * pool.length)].id, true);
});

/* ---------- 設定 ---------- */
function openSettings() {
  const m = $("#m-settings"); m.hidden = false; renderSettings();
}
function renderSettings() {
  $("#v-speed").textContent = save.speed.toFixed(1);
  $("#v-offset").textContent = (save.offset > 0 ? "+" : "") + save.offset + "ms";
  $("#r-music").value = save.music; $("#r-se").value = save.se;
  $("#t-hit").setAttribute("aria-pressed", save.hitsound); $("#t-hit").textContent = save.hitsound ? "ON" : "OFF";
  $("#t-lang").textContent = EN ? "日本語" : "English";
}
$$("[data-open-settings]").forEach(b => b.addEventListener("click", () => { audio(); ui(); openSettings(); }));
$("#m-settings").addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (!a) { if (e.target.id === "m-settings") e.target.hidden = true; return; }
  const act = a.dataset.act;
  if (act === "close") { $("#m-settings").hidden = true; persist(); return; }
  if (act === "speed-") save.speed = clamp(Math.round((save.speed - 0.5) * 2) / 2, 1, 10);
  if (act === "speed+") save.speed = clamp(Math.round((save.speed + 0.5) * 2) / 2, 1, 10);
  if (act === "offset-") save.offset = clamp(save.offset - 5, -200, 200);
  if (act === "offset+") save.offset = clamp(save.offset + 5, -200, 200);
  if (act === "hit") save.hitsound = !save.hitsound;
  if (act === "lang") { const next = EN ? "ja" : "en"; try { localStorage.setItem("lang", next); } catch (x) {} const u = new URL(location.href); u.searchParams.set("lang", next); location.replace(u.href); return; }
  ui(); persist(); renderSettings();
});
$("#r-music").addEventListener("input", e => { save.music = +e.target.value; applyVolume(); persist(); });
$("#r-se").addEventListener("input", e => { save.se = +e.target.value; applyVolume(); blip(1400, 0.25); persist(); });

/* ---------- プレイ ---------- */
let G = null, paused = false;
const cv = $("#cv"), cx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + "px"; cv.style.height = H + "px";
}
addEventListener("resize", resize); resize();

function startGame() {
  audio(); stopPreview();
  const data = M.get(selId), ch = M.chartOf(selId, diff);
  const notes = ch.notes.map(n => ({ t: n.t, lane: n.lane, len: n.len, j: null, tail: null, holding: false }));
  const total = notes.length + notes.filter(n => n.len).length;
  const leadIn = save.tut ? 2 : 3.2;
  G = {
    data, diff, song: data.song, notes, total, first: 0,
    score: 0, shown: 0, acc: 0, combo: 0, maxCombo: 0, life: 100, failed: false, ended: false,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 }, fastSlow: { fast: 0, slow: 0 },
    pressed: [false, false, false, false], flash: [-9, -9, -9, -9], holds: [null, null, null, null],
    fx: [], judge: null, comboPop: 0, milestone: -9, tut: !save.tut,
  };
  G.player = M.Player(AC, MUSIC, data, { lead: leadIn });
  G.startTime = G.player.startTime;
  paused = false; $("#m-pause").hidden = true;
  show("play");
  if (PF.gameplayStart) PF.gameplayStart();
  save.plays++; save.tut = true; persist();
  if (PF.track) PF.track("song_start", { song: data.song.id, diff });
}
const latency = () => AC ? (AC.outputLatency || AC.baseLatency || 0) : 0;
const songTime = () => AC.currentTime - G.startTime - latency() - save.offset / 1000;

function judge(n, d, isTail) {
  const a = Math.abs(d);
  const j = a <= WIN.perfect ? "perfect" : a <= WIN.great ? "great" : a <= WIN.good ? "good" : "miss";
  apply(j, n.lane, d);
  return j;
}
function apply(j, lane, d = 0) {
  G.counts[j]++; G.acc += JW[j];
  G.score = Math.round(1e6 * G.acc / G.total);
  if (j === "miss") {
    G.combo = 0; G.life = Math.max(0, G.life - ({ easy: 4, normal: 6, hard: 8, oni: 9 })[G.diff]);
    if (G.life <= 0 && !G.failed && !AUTO) fail();
  } else {
    G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.comboPop = 1;
    G.life = Math.min(100, G.life + (j === "perfect" ? 1 : j === "great" ? 0.6 : 0.2));
    if (j !== "perfect" && d) G.fastSlow[d < 0 ? "fast" : "slow"]++;
    burst(lane, j);
    if (G.combo % 50 === 0) { G.milestone = performance.now(); blip(2000, 0.18, 0.12, "sine"); }
  }
  G.judge = { j, at: performance.now(), fs: j !== "perfect" && j !== "miss" && d ? (d < 0 ? "FAST" : "SLOW") : "" };
}
function press(lane) {
  if (!G || paused || G.ended) return;
  G.pressed[lane] = true; G.flash[lane] = performance.now();
  if (AUTO) return;
  const t = songTime();
  let best = null, bd = 9;
  for (let i = G.first; i < G.notes.length; i++) {
    const n = G.notes[i];
    if (n.t - t > WIN.good) break;
    if (n.lane !== lane || n.j) continue;
    const d = t - n.t;
    if (Math.abs(d) <= WIN.good && Math.abs(d) < bd) { best = n; bd = Math.abs(d); }
  }
  if (!best) return;
  best.j = judge(best, t - best.t);
  blip(best.j === "perfect" ? 1500 : 1200, 0.22, 0.045);
  if (best.len) { best.holding = true; G.holds[lane] = best; }
}
function release(lane) {
  if (!G) return;
  G.pressed[lane] = false;
  if (AUTO) return;
  const n = G.holds[lane]; if (!n || paused) return;
  G.holds[lane] = null; n.holding = false;
  const t = songTime(), end = n.t + n.len;
  if (end - t > WIN.good) { n.tail = "miss"; apply("miss", lane); }
  else { n.tail = "perfect"; apply("perfect", lane); }
}
function update() {
  const t = songTime();
  for (let i = G.first; i < G.notes.length; i++) {
    const n = G.notes[i];
    if (n.t > t + 0.2) break;
    if (AUTO && !n.j && t >= n.t) { n.j = "perfect"; apply("perfect", n.lane); G.flash[n.lane] = performance.now(); blip(1500, 0.15, 0.04); if (n.len) { n.holding = true; G.holds[n.lane] = n; G.pressed[n.lane] = true; } }
    if (!n.j && t - n.t > WIN.good) { n.j = "miss"; apply("miss", n.lane); if (n.len) { n.tail = "miss"; apply("miss", n.lane); } }
    if (n.holding && t >= n.t + n.len) {
      n.holding = false; n.tail = "perfect"; G.holds[n.lane] = null; apply("perfect", n.lane);
      if (AUTO) G.pressed[n.lane] = false;
    }
  }
  while (G.first < G.notes.length) {
    const n = G.notes[G.first];
    if (n.j && (!n.len || n.tail) && t - (n.t + n.len) > 0.5) G.first++; else break;
  }
  if (!G.ended && G.first >= G.notes.length && t > G.data.dur + 0.3) finish();
}

function burst(lane, j) {
  const c = j === "perfect" ? "#fff27a" : LANE_COLOR[lane];
  for (let i = 0; i < (j === "perfect" ? 14 : 8); i++) {
    const a = -Math.PI * (0.1 + Math.random() * 0.8), v = 180 + Math.random() * 420;
    G.fx.push({ lane, x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c, s: 2 + Math.random() * 3 });
  }
  G.fx.push({ lane, ring: true, life: 1, c });
}

function fail() {
  G.failed = true; G.ended = true;
  G.player.stop();
  if (PF.gameplayStop) PF.gameplayStop();
  setTimeout(() => results(), 1400);
}
function finish() {
  G.ended = true;
  G.player.stop();
  if (PF.gameplayStop) PF.gameplayStop();
  setTimeout(() => results(), G.counts.miss === 0 ? 1600 : 700);
}

/* ---------- 入力 ---------- */
const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, KeyS: 0, KeyL: 3 };
addEventListener("keydown", e => {
  if (screen === "play") {
    if (e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); return paused ? resume() : pause(); }
    if (e.code in KEYS) { e.preventDefault(); if (!e.repeat) press(KEYS[e.code]); }
    return;
  }
  if (!$("#m-settings").hidden) { if (e.code === "Escape") $("#m-settings").hidden = true; return; }
  if (screen === "title" && (e.code === "Enter" || e.code === "Space")) { e.preventDefault(); $("#start").click(); }
  else if (screen === "select") {
    const list = M.SONGS.filter(s => genreFilter === "all" || s.genre === genreFilter), i = list.findIndex(s => s.id === selId);
    if (e.code === "ArrowDown" || e.code === "ArrowUp") { e.preventDefault(); const n = list[(i + (e.code === "ArrowDown" ? 1 : -1) + list.length) % list.length]; ui(1000); select(n.id, true); }
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") { e.preventDefault(); const di = clamp(M.DIFFS.indexOf(diff) + (e.code === "ArrowRight" ? 1 : -1), 0, 3); $(`#diffs .diff[data-d="${M.DIFFS[di]}"]`).click(); }
    if (e.code === "Enter") { e.preventDefault(); startGame(); }
  } else if (screen === "result") {
    if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); $("#r-retry").click(); }
    if (e.code === "Escape") $("#r-back").click();
  }
});
addEventListener("keyup", e => { if (screen === "play" && e.code in KEYS) release(KEYS[e.code]); });
const touchLane = new Map();
const laneAt = x => { const L = layout(); return clamp(Math.floor((x - (L.cx - L.lw * 2)) / L.lw), 0, 3); };
const pad = $("#touch");
pad.addEventListener("pointerdown", e => { e.preventDefault(); const l = laneAt(e.clientX); touchLane.set(e.pointerId, l); try { pad.setPointerCapture(e.pointerId); } catch (x) {} press(l); });
const up = e => { if (!touchLane.has(e.pointerId)) return; const l = touchLane.get(e.pointerId); touchLane.delete(e.pointerId); if (![...touchLane.values()].includes(l)) release(l); };
pad.addEventListener("pointerup", up); pad.addEventListener("pointercancel", up);
pad.addEventListener("pointermove", e => { // 指をすべらせて隣のレーンへ移る
  if (!touchLane.has(e.pointerId)) return;
  const l = laneAt(e.clientX), o = touchLane.get(e.pointerId);
  if (l !== o && !G?.holds[o]) { touchLane.set(e.pointerId, l); if (![...touchLane.values()].includes(o)) G.pressed[o] = false; press(l); }
});
pad.addEventListener("contextmenu", e => e.preventDefault());

/* ---------- 一時停止 ---------- */
function pause() {
  if (!G || G.ended || paused) return;
  paused = true; AC.suspend();
  for (let l = 0; l < 4; l++) { G.pressed[l] = false; }
  touchLane.clear();
  $("#m-pause").hidden = false; $("#count").hidden = true;
}
function resume() {
  if (!paused) return;
  $("#m-pause").hidden = true;
  const c = $("#count"); c.hidden = false; let n = 3; c.textContent = n;
  const iv = setInterval(() => {
    n--; if (n > 0) { c.textContent = n; return; }
    clearInterval(iv); c.hidden = true; paused = false;
    // 一時停止中に指を離していたロングノーツはここで判定
    for (let l = 0; l < 4; l++) if (G.holds[l]) release(l);
    if (!PF.adPlaying) AC.resume();
  }, 600);
}
$("#pause").addEventListener("click", e => { e.stopPropagation(); pause(); });
$("#m-pause").addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  if (a.dataset.act === "resume") resume();
  if (a.dataset.act === "retry") { quitSong(); AC.resume(); startGame(); }
  if (a.dataset.act === "quit") { quitSong(); AC.resume(); adGate(openSelect); }
});
function quitSong() { if (G) { G.player.stop(); if (!G.ended && PF.gameplayStop) PF.gameplayStop(); G.ended = true; } paused = false; $("#m-pause").hidden = true; }
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (screen === "play") pause(); else if (AC) AC.suspend(); }
  else if (AC && screen !== "play" && !PF.adPlaying) AC.resume();
});
const adGate = fn => { stopPreview(); return PF.midgame ? PF.midgame(fn) : fn(); };

/* ---------- 結果 ---------- */
function results() {
  if (screen !== "play" || !G) return;
  const s = G.song, key = s.id + "/" + G.diff, prev = save.best[key];
  const fc = !G.failed && G.counts.miss === 0, ap = fc && G.counts.great === 0 && G.counts.good === 0;
  const rank = G.failed ? "F" : rankOf(G.score);
  const isNew = !G.failed && (!prev || G.score > prev.score);
  if (!G.failed && !AUTO) {
    save.best[key] = { score: Math.max(G.score, prev?.score || 0), rank: isNew ? rank : prev.rank, combo: Math.max(G.maxCombo, prev?.combo || 0), fc: fc || !!prev?.fc, ap: ap || !!prev?.ap };
    persist();
  }
  show("result");
  const g = M.GENRES[s.genre];
  $("#r-jacket").src = jacket(s, 240);
  $("#r-title").textContent = s.title;
  $("#r-diff").textContent = DIFF_LABEL[G.diff] + " Lv." + M.chartOf(s.id, G.diff).level;
  $("#r-diff").style.setProperty("--dc", DIFF_COLOR[G.diff]);
  const rk = $("#r-rank"); rk.textContent = rank; rk.style.setProperty("--rc", RANK_COLOR[rank] || "#ff5a7a"); rk.classList.remove("pop"); void rk.offsetWidth; rk.classList.add("pop");
  $("#r-badge").textContent = G.failed ? tr("ライフがなくなった…", "Out of life…") : ap ? "ALL PERFECT!!" : fc ? "FULL COMBO!" : tr("クリア！", "CLEAR!");
  $("#r-badge").className = "badge " + (G.failed ? "fail" : ap ? "ap" : fc ? "fc" : "");
  $("#r-new").hidden = !isNew || G.failed;
  $("#r-counts").innerHTML = ["perfect", "great", "good", "miss"].map(j => `<div style="--jc:${JCOLOR[j]}"><span>${JLABEL[j]}</span><b>${G.counts[j]}</b></div>`).join("") +
    `<div style="--jc:#fff"><span>MAX COMBO</span><b>${G.maxCombo}</b></div><div style="--jc:#a9a3c9"><span>FAST / SLOW</span><b>${G.fastSlow.fast} / ${G.fastSlow.slow}</b></div>`;
  const sc = $("#r-score"), target = G.score, t0 = performance.now();
  const step = () => { const p = Math.min(1, (performance.now() - t0) / 900); sc.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString(); if (p < 1) requestAnimationFrame(step); };
  step();
  $("#r-share").hidden = !!PF.noShare;
  blip(isNew ? 1800 : 1200, 0.2, 0.25, "sine");
  if (PF.track) PF.track("song_end", { song: s.id, diff: G.diff, score: G.score, rank });
}
$("#r-retry").addEventListener("click", () => { ui(); adGate(startGame); });
$("#r-back").addEventListener("click", () => { ui(); adGate(openSelect); });
$("#r-share").addEventListener("click", shareCard);

async function shareCard() {
  if (!G) return;
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const x = c.getContext("2d"), s = G.song, g = M.GENRES[s.genre];
  const bg = x.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, "#0b0820"); bg.addColorStop(1, "#1a0b33"); x.fillStyle = bg; x.fillRect(0, 0, 1080, 1350);
  const gl = x.createRadialGradient(540, 420, 50, 540, 420, 700); gl.addColorStop(0, g.color[0] + "55"); gl.addColorStop(1, "transparent"); x.fillStyle = gl; x.fillRect(0, 0, 1080, 1350);
  const img = new Image(); img.src = jacket(s, 240); await img.decode().catch(() => {});
  x.drawImage(img, 390, 120, 300, 300);
  x.textAlign = "center"; x.fillStyle = "#f4f1ff";
  x.font = '700 64px Unbounded, "M PLUS Rounded 1c", sans-serif'; x.fillText(s.title, 540, 520, 980);
  x.fillStyle = DIFF_COLOR[G.diff]; x.font = '800 44px "M PLUS Rounded 1c", sans-serif'; x.fillText(DIFF_LABEL[G.diff] + "  Lv." + M.chartOf(s.id, G.diff).level, 540, 590);
  const rank = G.failed ? "F" : rankOf(G.score);
  x.fillStyle = RANK_COLOR[rank] || "#ff5a7a"; x.font = '700 260px Unbounded, sans-serif'; x.fillText(rank, 540, 870, 900);
  x.fillStyle = "#f4f1ff"; x.font = '700 96px Unbounded, sans-serif'; x.fillText(G.score.toLocaleString(), 540, 1010);
  x.fillStyle = "#a9a3c9"; x.font = '800 40px "M PLUS Rounded 1c", sans-serif';
  x.fillText(`PERFECT ${G.counts.perfect}  ·  MAX COMBO ${G.maxCombo}`, 540, 1090);
  x.fillStyle = "#ff4fd8"; x.font = '700 54px Unbounded, sans-serif'; x.fillText("PULSE RUSH", 540, 1240);
  x.fillStyle = "#a9a3c9"; x.font = '600 30px "M PLUS Rounded 1c", sans-serif'; x.fillText(location.host + location.pathname, 540, 1295);
  const text = tr(`Pulse Rush「${s.title}」${DIFF_LABEL[G.diff]}で ${rank}ランク ${G.score.toLocaleString()}点！ #PulseRush #音ゲー`, `I got rank ${rank} (${G.score.toLocaleString()}) on "${s.title}" ${DIFF_LABEL[G.diff]} in Pulse Rush! #PulseRush`);
  c.toBlob(async blob => {
    const file = new File([blob], "pulse-rush.png", { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + " " + location.href }); return; } } catch (e) { if (e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pulse-rush.png"; a.click();
    open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(location.href), "_blank", "noopener");
  });
}

/* ---------- 描画 ---------- */
const sprites = {};
function noteSprite(color) {
  if (sprites[color]) return sprites[color];
  const c = document.createElement("canvas"); c.width = 220; c.height = 72;
  const x = c.getContext("2d");
  x.shadowColor = color; x.shadowBlur = 18;
  const g = x.createLinearGradient(0, 18, 0, 54); g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, color); g.addColorStop(1, color);
  x.fillStyle = g; x.beginPath(); x.roundRect(14, 20, 192, 32, 12); x.fill();
  x.shadowBlur = 0; x.fillStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.roundRect(30, 25, 160, 6, 3); x.fill();
  return (sprites[color] = c);
}
function layout() {
  const portrait = H > W;
  const lw = Math.min((W - 24) / 4, portrait ? W * 0.235 : H * 0.17, 150);
  return { cx: W / 2, lw, hitY: H * (portrait ? 0.82 : 0.84), horizon: H * (portrait ? 0.14 : 0.13), K: 1.9 };
}
const proj = (L, z) => { const s = 1 / (1 + L.K * z); return { s, y: L.hitY - (L.hitY - L.horizon) * (1 - s) / (1 - 1 / (1 + L.K)) }; };
const approach = () => 6.4 / (save.speed + 1.4);

function drawBackground(t, beat, pulse, c1, c2) {
  const x = cx;
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#07051a"); bg.addColorStop(0.55, "#0d0626"); bg.addColorStop(1, "#05040d");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const L = layout();
  // 地平線の光
  const glow = x.createRadialGradient(W / 2, L.horizon, 10, W / 2, L.horizon, Math.max(W, H) * 0.7);
  glow.addColorStop(0, c1 + Math.round(40 + 90 * pulse).toString(16).padStart(2, "0")); glow.addColorStop(0.4, c2 + "22"); glow.addColorStop(1, "transparent");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  // 太陽
  x.save(); x.globalAlpha = 0.5 + 0.3 * pulse;
  const sr = Math.min(W * 0.2, H * 0.11), sg = x.createLinearGradient(0, L.horizon - sr, 0, L.horizon);
  sg.addColorStop(0, "#fff27a"); sg.addColorStop(1, c1);
  x.fillStyle = sg; x.beginPath(); x.arc(W / 2, L.horizon, sr * (1 + pulse * 0.05), Math.PI, 0); x.fill();
  x.fillStyle = "#0b0624"; for (let i = 1; i < 6; i++) x.fillRect(W / 2 - sr, L.horizon - sr * 0.12 * i * 1.15, sr * 2, i * 1.5);
  x.restore();
  // 流れる床のグリッド
  x.save(); x.strokeStyle = c2; x.lineWidth = 1;
  const span = 8, off = (beat % 1);
  for (let i = 0; i < span; i++) {
    const z = (i + 1 - off) / span * 1.2;
    if (z < 0 || z > 1.2) continue;
    const p = proj(L, z); x.globalAlpha = 0.08 + 0.25 * (1 - z / 1.2);
    x.beginPath(); x.moveTo(0, p.y); x.lineTo(W, p.y); x.stroke();
  }
  x.globalAlpha = 0.14;
  for (let i = -10; i <= 10; i++) {
    const far = proj(L, 1.2), near = proj(L, -0.25);
    x.beginPath(); x.moveTo(W / 2 + i * L.lw * 1.2 * far.s, far.y); x.lineTo(W / 2 + i * L.lw * 1.2 * near.s, near.y); x.stroke();
  }
  x.restore();
  // 星
  x.fillStyle = "#fff";
  for (let i = 0; i < 50; i++) {
    const sx = (i * 9301 % 997) / 997 * W, sy = (i * 4973 % 991) / 991 * L.horizon;
    x.globalAlpha = 0.2 + 0.5 * Math.abs(Math.sin(t * 0.7 + i));
    x.fillRect(sx, sy, 1.5, 1.5);
  }
  x.globalAlpha = 1;
}

function drawPlay(now) {
  const x = cx, L = layout(), t = songTime(), A = approach();
  const d = G.data, beat = t / (60 / d.bpm);
  const kickAgo = (() => { // 直前のキックからの時間で画面を脈打たせる
    let lo = 0, hi = d.steps.length - 1, i = Math.floor(t / d.step);
    i = clamp(i, 0, hi); for (let k = i; k >= Math.max(0, i - 16); k--) if (d.steps[k].kick && d.steps[k].t <= t) return t - d.steps[k].t;
    return 9;
  })();
  const pulse = Math.exp(-kickAgo * 7);
  const [c1, c2] = M.GENRES[G.song.genre].color;
  drawBackground(now / 1000, Math.max(0, beat), pulse, c1, c2);

  const left = e => L.cx + (e - 2) * L.lw;
  // レーン
  const far = proj(L, 1), near = proj(L, -0.12);
  x.save();
  x.beginPath();
  x.moveTo(L.cx - 2 * L.lw * far.s, far.y); x.lineTo(L.cx + 2 * L.lw * far.s, far.y);
  x.lineTo(L.cx + 2 * L.lw * near.s, near.y); x.lineTo(L.cx - 2 * L.lw * near.s, near.y); x.closePath();
  const lg = x.createLinearGradient(0, far.y, 0, near.y); lg.addColorStop(0, "rgba(10,6,30,.2)"); lg.addColorStop(1, "rgba(10,6,30,.85)");
  x.fillStyle = lg; x.fill();
  x.restore();
  // 押しているレーンの光
  for (let l = 0; l < 4; l++) {
    const age = (now - G.flash[l]) / 1000, a = G.pressed[l] ? 0.55 : Math.max(0, 0.45 - age * 2.5);
    if (a <= 0) continue;
    x.save(); x.globalAlpha = a; x.globalCompositeOperation = "lighter";
    const top = proj(L, 0.55);
    const g = x.createLinearGradient(0, top.y, 0, L.hitY); g.addColorStop(0, "transparent"); g.addColorStop(1, LANE_COLOR[l]);
    x.fillStyle = g; x.beginPath();
    x.moveTo(L.cx + (l - 2) * L.lw * top.s, top.y); x.lineTo(L.cx + (l - 1) * L.lw * top.s, top.y);
    x.lineTo(L.cx + (l - 1) * L.lw, L.hitY); x.lineTo(L.cx + (l - 2) * L.lw, L.hitY); x.fill();
    x.restore();
  }
  // 区切り線
  x.save();
  for (let e = 0; e <= 4; e++) {
    const edge = e === 0 || e === 4;
    x.strokeStyle = edge ? (e === 0 ? c1 : c2) : "rgba(255,255,255,.12)"; x.lineWidth = edge ? 3 : 1;
    if (edge) { x.shadowColor = x.strokeStyle; x.shadowBlur = 12 + 12 * pulse; }
    x.beginPath(); x.moveTo(L.cx + (e - 2) * L.lw * far.s, far.y); x.lineTo(L.cx + (e - 2) * L.lw * near.s, near.y); x.stroke();
    x.shadowBlur = 0;
  }
  // 小節線
  const barLen = 16 * d.step;
  for (let b = Math.ceil(t / barLen); b * barLen < t + A; b++) {
    const z = (b * barLen - t) / A; if (z < 0) continue; const p = proj(L, z);
    x.strokeStyle = "rgba(255,255,255," + (0.18 * (1 - z)) + ")"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(L.cx - 2 * L.lw * p.s, p.y); x.lineTo(L.cx + 2 * L.lw * p.s, p.y); x.stroke();
  }
  x.restore();
  // 判定ライン
  x.save();
  x.shadowColor = "#fff"; x.shadowBlur = 14 + 16 * pulse;
  x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(L.cx - 2 * L.lw, L.hitY); x.lineTo(L.cx + 2 * L.lw, L.hitY); x.stroke();
  x.restore();
  for (let l = 0; l < 4; l++) { // 受け皿
    const on = G.pressed[l], cxl = L.cx + (l - 1.5) * L.lw;
    x.save(); x.globalAlpha = on ? 1 : 0.5;
    x.strokeStyle = LANE_COLOR[l]; x.lineWidth = 2.5; x.shadowColor = LANE_COLOR[l]; x.shadowBlur = on ? 18 : 6;
    x.beginPath(); x.roundRect(cxl - L.lw * 0.42, L.hitY - 13, L.lw * 0.84, 26, 10); x.stroke();
    x.restore();
    if (!matchMedia("(pointer:coarse)").matches) {
      x.fillStyle = "rgba(255,255,255,.4)"; x.font = `700 ${Math.round(L.lw * 0.16)}px Unbounded, sans-serif`; x.textAlign = "center";
      x.fillText("DFJK"[l], cxl, L.hitY + 44);
    }
  }

  // ノーツ（奥から手前へ）
  const vis = [];
  for (let i = G.first; i < G.notes.length; i++) {
    const n = G.notes[i];
    if (n.t - t > A * 1.02) break;
    vis.push(n);
  }
  for (let k = vis.length - 1; k >= 0; k--) {
    const n = vis[k];
    if (n.len) {
      if (n.tail) continue;
      const z0 = n.holding ? 0 : (n.t - t) / A, z1 = Math.min(1, (n.t + n.len - t) / A);
      if (z1 < -0.12) continue;
      const a = Math.max(z0, -0.12), p0 = proj(L, a), p1 = proj(L, Math.max(a, z1));
      const w = 0.32;
      x.save();
      x.globalAlpha = n.j === "miss" ? 0.25 : n.holding ? 0.85 : 0.6;
      const g = x.createLinearGradient(0, p1.y, 0, p0.y); g.addColorStop(0, LANE_COLOR[n.lane] + "33"); g.addColorStop(1, LANE_COLOR[n.lane] + "cc");
      x.fillStyle = g; x.beginPath();
      x.moveTo(L.cx + (n.lane - 1.5 - w) * L.lw * p0.s, p0.y); x.lineTo(L.cx + (n.lane - 1.5 + w) * L.lw * p0.s, p0.y);
      x.lineTo(L.cx + (n.lane - 1.5 + w) * L.lw * p1.s, p1.y); x.lineTo(L.cx + (n.lane - 1.5 - w) * L.lw * p1.s, p1.y); x.fill();
      if (n.holding) { x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.5 + 0.3 * Math.sin(now / 50); x.fill(); }
      x.restore();
      if (!n.holding && z1 > -0.12) { const pt = proj(L, z1); drawNote(L, n.lane, pt, 0.55, n.j === "miss" ? 0.3 : 0.9); }
    }
    if (n.j && !(n.j === "miss" && !n.len)) continue;
    const z = (n.t - t) / A;
    if (z < -0.12) continue;
    const p = proj(L, z);
    drawNote(L, n.lane, p, 1, n.j === "miss" ? Math.max(0, 1 + z * 8) * 0.5 : 1);
  }

  // エフェクト
  x.save(); x.globalCompositeOperation = "lighter";
  const dt = 1 / 60;
  G.fx = G.fx.filter(f => f.life > 0);
  for (const f of G.fx) {
    const bx = L.cx + (f.lane - 1.5) * L.lw;
    if (f.ring) {
      f.life -= dt * 3.2;
      x.globalAlpha = Math.max(0, f.life); x.strokeStyle = f.c; x.lineWidth = 3;
      x.beginPath(); x.ellipse(bx, L.hitY, L.lw * (0.5 + (1 - f.life) * 0.5), 16 + (1 - f.life) * 22, 0, 0, 7); x.stroke();
    } else {
      f.life -= dt * 1.8; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt;
      x.globalAlpha = Math.max(0, f.life); x.fillStyle = f.c; x.fillRect(bx + f.x, L.hitY + f.y, f.s, f.s);
    }
  }
  x.restore();

  // 判定の文字とコンボ
  const midY = proj(L, 0.42).y;
  if (G.combo >= 3) {
    G.comboPop = Math.max(0, G.comboPop - 0.08);
    const sz = Math.round(L.lw * 0.62 * (1 + G.comboPop * 0.18));
    x.save(); x.textAlign = "center"; x.globalAlpha = 0.9;
    x.font = `700 ${sz}px Unbounded, sans-serif`;
    const cg = x.createLinearGradient(0, midY - sz, 0, midY); cg.addColorStop(0, "#fff"); cg.addColorStop(1, c1);
    x.fillStyle = cg; x.shadowColor = c1; x.shadowBlur = 20;
    x.fillText(G.combo, L.cx, midY);
    x.shadowBlur = 0; x.globalAlpha = 0.7; x.fillStyle = "#fff"; x.font = `700 ${Math.round(L.lw * 0.14)}px Unbounded, sans-serif`;
    x.fillText("COMBO", L.cx, midY + L.lw * 0.22);
    x.restore();
  }
  if (G.judge) {
    const age = (now - G.judge.at) / 1000;
    if (age < 0.5) {
      const s = 1 + Math.max(0, 0.25 - age) * 1.2, y = proj(L, 0.17).y;
      x.save(); x.textAlign = "center"; x.globalAlpha = Math.min(1, (0.5 - age) * 5);
      x.font = `700 ${Math.round(L.lw * 0.3 * s)}px Unbounded, sans-serif`;
      x.fillStyle = JCOLOR[G.judge.j]; x.shadowColor = JCOLOR[G.judge.j]; x.shadowBlur = 16;
      x.fillText(JLABEL[G.judge.j], L.cx, y);
      if (G.judge.fs) { x.shadowBlur = 0; x.font = `700 ${Math.round(L.lw * 0.13)}px Unbounded, sans-serif`; x.fillStyle = G.judge.fs === "FAST" ? "#5ec8ff" : "#ff9a5e"; x.fillText(G.judge.fs, L.cx, y + L.lw * 0.2); }
      x.restore();
    }
  }
  // 50コンボごとの光
  const ms = (now - G.milestone) / 1000;
  if (ms < 0.6) { x.save(); x.globalAlpha = (0.6 - ms) * 0.5; x.fillStyle = c1; x.globalCompositeOperation = "lighter"; x.fillRect(0, 0, W, H); x.restore(); }

  // 上の表示: スコア・ライフ・進み具合
  const pad = 14, top = 14;
  G.shown += (G.score - G.shown) * 0.25;
  x.save(); x.textAlign = "right"; x.fillStyle = "#fff"; x.font = `700 ${W < 420 ? 20 : 26}px Unbounded, sans-serif`;
  x.fillText(Math.round(G.shown).toString().padStart(7, "0"), W - pad, top + 26);
  x.font = '800 12px "M PLUS Rounded 1c", sans-serif'; x.fillStyle = DIFF_COLOR[G.diff];
  x.fillText(DIFF_LABEL[G.diff] + " Lv." + M.chartOf(G.song.id, G.diff).level, W - pad, top + 46);
  x.textAlign = "left"; x.fillStyle = "rgba(255,255,255,.75)"; x.font = '800 13px "M PLUS Rounded 1c", sans-serif';
  x.fillText(G.song.title, 62, top + 18, W - 210);
  // ライフ
  const lwid = Math.min(220, W - 230 > 120 ? W - 230 : W * 0.4), ly = top + 28;
  x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.roundRect(62, ly, lwid, 8, 4); x.fill();
  const lc = G.life > 50 ? "#3dffa0" : G.life > 25 ? "#ffb03d" : "#ff3d7f";
  x.fillStyle = lc; x.shadowColor = lc; x.shadowBlur = 8; x.beginPath(); x.roundRect(62, ly, lwid * G.life / 100, 8, 4); x.fill();
  x.shadowBlur = 0;
  // 進み具合
  x.fillStyle = "rgba(255,255,255,.1)"; x.fillRect(0, 0, W, 3);
  x.fillStyle = c1; x.fillRect(0, 0, W * clamp(t / d.dur, 0, 1), 3);
  x.restore();

  // はじめての人向けの説明・カウントダウン
  if (t < 0) {
    x.save(); x.textAlign = "center"; x.fillStyle = "#fff";
    if (G.tut) {
      x.globalAlpha = Math.min(1, -t * 2);
      x.font = `800 ${W < 420 ? 17 : 20}px "M PLUS Rounded 1c", sans-serif`;
      x.fillText(tr("ノーツが線に重なったらタップ！", "Tap when notes hit the line!"), L.cx, H * 0.4);
      x.fillText(tr("長いノーツは最後まで押し続けてね", "Hold long notes until the end"), L.cx, H * 0.4 + 30);
      if (!matchMedia("(pointer:coarse)").matches) { x.fillStyle = "#4fe6ff"; x.fillText(tr("キーボード: D F J K", "Keyboard: D F J K"), L.cx, H * 0.4 + 64); }
    } else {
      x.globalAlpha = 0.9; x.font = `700 ${Math.round(L.lw * 0.25)}px Unbounded, sans-serif`;
      x.fillText(G.song.title, L.cx, H * 0.42, W - 40);
    }
    x.restore();
  }
  if (G.ended) {
    const label = G.failed ? "FAILED" : G.counts.miss === 0 ? (G.counts.great + G.counts.good === 0 ? "ALL PERFECT" : "FULL COMBO") : "CLEAR";
    x.save(); x.textAlign = "center"; x.font = `700 ${Math.round(Math.min(W / 9, 64))}px Unbounded, sans-serif`;
    const fg = x.createLinearGradient(0, H * 0.4, W, H * 0.5); fg.addColorStop(0, G.failed ? "#ff3d7f" : "#fff27a"); fg.addColorStop(1, G.failed ? "#a9a3c9" : c1);
    x.fillStyle = fg; x.shadowColor = c1; x.shadowBlur = 30; x.fillText(label, W / 2, H * 0.48);
    x.restore();
  }
}
function drawNote(L, lane, p, scaleH, alpha) {
  const w = L.lw * 0.9 * p.s, h = Math.max(10, L.lw * 0.3) * p.s * scaleH;
  const img = noteSprite(LANE_COLOR[lane]);
  cx.globalAlpha = alpha;
  cx.drawImage(img, L.cx + (lane - 1.5) * L.lw * p.s - w * 220 / 192 / 2, p.y - h * 72 / 32 / 2, w * 220 / 192, h * 72 / 32);
  cx.globalAlpha = 1;
}

function drawMenu(now) {
  let beat = now / 1000 * 2, pulse = 0.3 + 0.2 * Math.sin(now / 400);
  let c1 = "#ff4fd8", c2 = "#4fe6ff";
  if (screen === "select" && selId) [c1, c2] = M.GENRES[M.SONGS.find(s => s.id === selId).genre].color;
  if (preview && AC) {
    const d = preview.data, tt = AC.currentTime - preview.startTime;
    beat = tt / (60 / d.bpm);
    const ph = (beat % 1 + 1) % 1; pulse = Math.exp(-ph * (60 / d.bpm) * 7);
  }
  drawBackground(now / 1000, Math.max(0, beat), pulse, c1, c2);
}

function frame(now) {
  requestAnimationFrame(frame);
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (screen === "play" && G) {
    if (!paused && !G.ended) update();
    drawPlay(now);
  } else drawMenu(now);
}
requestAnimationFrame(frame);

show("title");
$("#songcount").textContent = M.SONGS.length;
if (Q.has("song")) { const s = M.SONGS.find(x => x.id === Q.get("song")); if (s) selId = s.id; }
if (Q.has("diff") && M.DIFFS.includes(Q.get("diff"))) diff = Q.get("diff");
document.documentElement.classList.add("ready");
window.__pr = { get G() { return G; }, startGame, openSelect, M, songTime: () => songTime() };
});
