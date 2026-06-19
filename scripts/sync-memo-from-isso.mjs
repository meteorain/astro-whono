// 从 Isso /latest 拉评论，生成 memo/index.md：保留 MD 里原有的 frontmatter + 引言（你的内容），
// 只用评论替换「## 年份」条目。
//   - 条目标题：评论开头第一段「词」（详见 titleOf）
//   - 条目正文：评论原文，末尾右对齐淡色小字拼上「作者(小写) · 月-日」
// 服务端拉取，无 CORS。用法：node scripts/sync-memo-from-isso.mjs
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMO = path.join(ROOT, 'src/content/memo/index.md');
const ISSO_URL = process.env.ISSO_LATEST_URL || 'https://isso.fly.dev/latest?limit=1000';
const SIG_STYLE = 'text-align:right;color:var(--faint);font-size:.8em;line-height:1.4;margin-top:-8px';

const getJson = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return getJson(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        let d = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });

// 还原被转义的 HTML 实体：老评论里的 <br>/<a> 以 &lt;br&gt; 形式存着，
// 解码回真标签才能被渲染（br→换行、a→链接），随后仍会过主题 sanitize 白名单。
const decodeEntities = (s) =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const stripHtml = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, '')).trim();

// 标题 = 开头第一段「词」：字母/数字/英文减号「-」算词字符（减号不终止，继续往后取）；
// 遇到中文感叹号「！」或问号「？」则停止，但把这个「！」「？」一并含进标题。
function titleOf(plain) {
  const lead = plain.match(/^[\p{L}\p{N}-]+[！？]?/u);
  let t = (lead ? lead[0] : plain.match(/[\p{L}\p{N}-]+[！？]?/u)?.[0] || plain.slice(0, 12)).trim();
  t = t.replace(/^-+/, '').replace(/-+$/, ''); // 去首尾多余的减号（！？保留）
  const chars = [...t];
  if (chars.length > 20) t = chars.slice(0, 20).join('') + '…';
  return t || '无题';
}

if (!fs.existsSync(MEMO)) {
  console.warn('⚠️  找不到 memo/index.md，跳过');
  process.exit(0);
}

// 保留 MD 里第一个 "## " 之前的所有内容（frontmatter + 引言，由你在 MD 里维护）
const head = fs.readFileSync(MEMO, 'utf8').split(/\n##\s/)[0].replace(/\s+$/, '');

let comments;
try {
  comments = await getJson(ISSO_URL);
} catch (e) {
  console.warn('⚠️  拉取 Isso 失败，保留现有 memo：', e.message);
  process.exit(0);
}
if (!Array.isArray(comments) || !comments.length) {
  console.warn('⚠️  Isso 返回空，保留现有 memo');
  process.exit(0);
}

const byYear = new Map();
for (const c of comments) {
  if (!c || !c.created || !c.text) continue;
  const d = new Date(c.created * 1000);
  const year = d.getFullYear();
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const author = String(c.author || '匿名').trim() || '匿名';
  const body = decodeEntities(String(c.text).trim());
  const title = titleOf(stripHtml(body));
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year).push({ author, mmdd, ts: c.created, body, title });
}

let out = head + '\n\n';
let total = 0;
for (const y of [...byYear.keys()].sort((a, b) => b - a)) {
  const items = byYear.get(y).sort((a, b) => b.ts - a.ts);
  out += `## ${y}年记\n\n`;
  for (const it of items) {
    out += `### ${it.title}\n\n${it.body}\n<p style="${SIG_STYLE}">— ${it.author.toLowerCase()} · ${it.mmdd}</p>\n\n`;
    total++;
  }
}

fs.writeFileSync(MEMO, out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
console.log(`✅ memo 生成：${byYear.size} 年，${total} 条评论`);
