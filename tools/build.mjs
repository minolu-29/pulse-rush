// 1つの元ファイル(src/index.html)から、配信先ごとの版を dist/ に作る
//   dist/web/                 … 自分のサイト（GitHub Pages）。広告・アクセス解析は monetize.config.json で設定
//   dist/<名前>-crazygames.zip … CrazyGames にアップロードする版
//   dist/<名前>-gamedistribution.zip … GameDistribution にアップロードする版
// 使い方: node tools/build.mjs（WEB_ONLY=1 を付けると自分のサイト版だけ作る。Vercel用）
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "monetize.config.json"), "utf8"));
const name = cfg.name || path.basename(ROOT);
const siteUrl = (process.env.SITE_URL || cfg.siteUrl).replace(/\/?$/, "/");
const web = cfg.web || {};
// src/index.html が読み込んでいる music.js・game.js を中に埋め込んで、1つのHTMLにする
const src = fs.readFileSync(path.join(ROOT, "src/index.html"), "utf8")
  .replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(ROOT, "src", f), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);
const platform = p => fs.readFileSync(path.join(ROOT, "src/platforms", p + ".js"), "utf8");
const pubId = (web.adsenseClient || "").replace(/^ca-/, "");

for (const m of ["<!--PLATFORM-->", "<!--WEB-HEAD-->", "<!--/WEB-HEAD-->"]) if (!src.includes(m)) throw new Error("src/index.html に " + m + " がありません");

const inject = (html, tags) => html.replace("<!--PLATFORM-->", tags.join("\n"));
const stripWebHead = html => html.replace(/<!--WEB-HEAD-->[\s\S]*?<!--\/WEB-HEAD-->\n?/, "");
const json = o => JSON.stringify(o).replace(/</g, "\\u003c");

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* ---------- 自分のサイト版 ---------- */
{
  const out = path.join(DIST, "web");
  fs.cpSync(path.join(ROOT, "public"), out, { recursive: true });
  const tags = [`<script>window.MONETIZE = ${json({ adsenseClient: web.adsenseClient || "", ga4: web.ga4 || "" })};</script>`];
  if (web.ga4) tags.push(
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${web.ga4}"></script>`,
    `<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag("js", new Date()); gtag("config", ${json(web.ga4)});</script>`);
  if (web.adsenseClient) tags.push(
    `<script async data-ad-client="${web.adsenseClient}"${web.adTest ? ' data-adbreak-test="on"' : ""} data-ad-frequency-hint="${web.adFrequency || "120s"}" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${web.adsenseClient}" crossorigin="anonymous"></script>`);
  tags.push(`<script>\n${platform("web")}</script>`);
  let html = inject(src, tags).replace(/<!--\/?WEB-HEAD-->\n?/g, "").replaceAll("%SITE_URL%", siteUrl);
  html = html.replace("<!--PRIVACY-LINK-->", '<a href="privacy.html">プライバシー / Privacy</a>');
  fs.writeFileSync(path.join(out, "index.html"), html);
  fs.writeFileSync(path.join(out, "privacy.html"), privacyPage());
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
  fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}</loc></url>\n  <url><loc>${siteUrl}privacy.html</loc></url>\n</urlset>\n`);
  // ads.txt はドメインの一番上に置く必要がある。独自ドメインをこのリポジトリに割り当てたときに効く
  if (pubId) fs.writeFileSync(path.join(out, "ads.txt"), `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
  if (cfg.customDomain) fs.writeFileSync(path.join(out, "CNAME"), cfg.customDomain + "\n");
  fs.writeFileSync(path.join(out, ".nojekyll"), "");
  console.log("web            →", path.relative(ROOT, out), web.adsenseClient ? "(広告あり" + (web.adTest ? "・テストモード" : "") + ")" : "(広告なし: adsenseClient が空)");
}

/* ---------- ゲームサイト向けの版 ---------- */
const webOnly = !!process.env.WEB_ONLY;
function portal(id, tags, note) {
  const dir = path.join(DIST, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), inject(stripWebHead(src), tags).replace("<!--PRIVACY-LINK-->", ""));
  const zip = path.join(DIST, `${name}-${id}.zip`);
  execFileSync("zip", ["-q", "-X", "-r", zip, "."], { cwd: dir });
  console.log(id.padEnd(15), "→", path.relative(ROOT, zip), note || "");
}
if (!webOnly) portal("crazygames", [
  `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>`,
  `<script>\n${platform("crazygames")}</script>`,
]);
const gdId = (cfg.gamedistribution || {}).gameId || "";
if (!webOnly) portal("gamedistribution", [
  `<script>window.MONETIZE = ${json({ gdGameId: gdId })};</script>`,
  `<script>\n${platform("gamedistribution")}</script>`,
], gdId ? "" : "(gameId が空: GameDistribution で登録したあと monetize.config.json に入れてください)");

/* ---------- プライバシーポリシー（広告を出すサイトには必須） ---------- */
function privacyPage() {
  const title = cfg.title || name;
  const contact = cfg.contact ? `<p>お問い合わせ / Contact: ${cfg.contact}</p>` : "";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>プライバシーポリシー / Privacy Policy | ${title}</title>
<style>body{font-family:system-ui,-apple-system,"Hiragino Sans",sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;line-height:1.8;color:#222;background:#fff}h1{font-size:22px}h2{font-size:17px;margin-top:28px}a{color:#2f6db0}</style></head>
<body>
<p><a href="./">← ${title}</a></p>
<h1>プライバシーポリシー</h1>
<p>${title}（以下「本サイト」）は、ゲームの記録を利用者のブラウザ内にのみ保存し、氏名やメールアドレスなどの個人情報を集めません。収録曲はすべて本作のためにプログラムで生成したオリジナル曲です。</p>
<h2>広告について</h2>
<p>本サイトは第三者配信の広告サービス（Google AdSense）を利用しています。広告配信事業者は、利用者の興味に応じた広告を表示するために Cookie を使用することがあります。Google による Cookie の使用は<a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener">広告に関するポリシー</a>をご覧ください。パーソナライズ広告は<a href="https://adssettings.google.com/" rel="noopener">広告設定</a>で無効にできます。</p>
<h2>アクセス解析について</h2>
<p>本サイトは、サイトの改善のために Google アナリティクスを利用することがあります。データは匿名で収集され、個人を特定するものではありません。</p>
${contact}
<hr>
<h1>Privacy Policy</h1>
<p>${title} ("this site") stores game records only in your browser and does not collect personal information such as names or email addresses.</p>
<h2>Advertising</h2>
<p>This site uses third-party advertising (Google AdSense). Advertising vendors may use cookies to show ads based on your interests. See <a href="https://policies.google.com/technologies/ads" rel="noopener">how Google uses cookies in advertising</a>. You can turn off personalized ads in <a href="https://adssettings.google.com/" rel="noopener">Ad Settings</a>.</p>
<h2>Analytics</h2>
<p>This site may use Google Analytics to improve the site. Data is collected anonymously and does not identify you.</p>
</body></html>
`;
}
