// 从 Notion「每日健康打卡」data source 同步成 astro-whono 的 bits（絮语）MD。
// 字段：Title(公式) / Date(公式) / Slug(公式) / Status(状态) + 页面图标 emoji。
// 用法：node --env-file=.env scripts/sync-bits-from-notion.mjs [--limit=N]
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DS = process.env.NOTION_BITS_DATA_SOURCE_ID;
const n2m = new NotionToMarkdown({ notionClient: notion });

const OUT_DIR = path.join(ROOT, 'src/generated-bits');
const IMG_DIR = path.join(ROOT, 'public/notion-bits');
const limit = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!process.env.NOTION_TOKEN || !DS) { console.warn('⚠️  未设置 NOTION_TOKEN / NOTION_BITS_DATA_SOURCE_ID，跳过 bits 同步（构建继续，bits 为空）'); process.exit(0); }

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.md')) fs.rmSync(path.join(OUT_DIR, f));
for (const f of fs.readdirSync(IMG_DIR)) fs.rmSync(path.join(IMG_DIR, f), { force: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { file.close(); fs.rmSync(dest, { force: true }); return download(res.headers.location, dest).then(resolve, reject); }
      if (res.statusCode !== 200) { file.close(); fs.rmSync(dest, { force: true }); return reject(new Error('HTTP ' + res.statusCode)); }
      res.pipe(file); file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { file.close(); fs.rmSync(dest, { force: true }); reject(e); });
  });
}
const extOf = (u) => { try { const e = path.extname(new URL(u).pathname); return /^\.(png|jpe?g|gif|webp|svg)$/i.test(e) ? e : '.png'; } catch { return '.png'; } };

async function localizeImages(md, slug) {
  const re = /!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g;
  let m, i = 0; const reps = [];
  while ((m = re.exec(md))) {
    const url = m[2];
    if (!/^https?:\/\//i.test(url)) continue;
    const name = `${slug}-${i++}-${crypto.createHash('md5').update(url).digest('hex').slice(0, 8)}${extOf(url)}`;
    try { await download(url, path.join(IMG_DIR, name)); reps.push([m[0], `![${m[1]}](/notion-bits/${name})`]); }
    catch (e) { console.log('  图片下载失败:', e.message); }
  }
  let out = md; for (const [a, b] of reps) out = out.replace(a, b); return out;
}
const y = (s) => JSON.stringify(String(s));

let cursor, total = 0, ok = 0, fail = 0;
const usedSlug = new Map();
outer: do {
  const q = await notion.dataSources.query({ data_source_id: DS, page_size: 100, start_cursor: cursor });
  for (const p of q.results) {
    if (total >= limit) break outer;
    total++;
    try {
      const pr = p.properties;
      const titleText = pr.Title?.formula?.string || '';
      const date = pr.Date?.formula?.date?.start;
      let slug = pr.Slug?.formula?.string;
      const status = pr.Status?.status?.name || pr.Status?.select?.name;
      const emoji = p.icon?.type === 'emoji' ? p.icon.emoji : '';
      if (!slug || !date) { console.log('跳过(缺 slug/date):', p.id); continue; }
      const n = (usedSlug.get(slug) || 0) + 1; usedSlug.set(slug, n); if (n > 1) slug = `${slug}-${n}`;
      // bits 是"无标题微博式"：内容放 body（主题两个视图都渲染 body，不渲染 title）。
      // 所以把 emoji + 心情文字放进正文开头，再接页面正文(图片等)。
      const noteText = (emoji ? emoji + ' ' : '') + titleText;
      let pageBody = '';
      try { const mb = await n2m.pageToMarkdown(p.id); pageBody = (n2m.toMarkdownString(mb).parent || '').trim(); pageBody = await localizeImages(pageBody, slug); }
      catch (e) { console.log('  正文转换失败(忽略):', e.message); }
      const body = noteText + (pageBody ? '\n\n' + pageBody : '');
      const fm = ['---', `date: ${date}`, `slug: ${y(slug)}`, `draft: ${status !== 'Published'}`, '---', ''].join('\n');
      fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), fm + body + '\n');
      ok++;
      console.log(`✅ ${slug} | ${noteText.slice(0, 24)} | draft=${status !== 'Published'}${pageBody ? ' | 有图/正文' : ''}`);
      await sleep(200);
    } catch (e) { fail++; console.log('❌', p.id, e.message); }
  }
  cursor = q.has_more ? q.next_cursor : undefined;
} while (cursor);
console.log(`\n完成：成功 ${ok}，失败 ${fail}，共 ${total}`);
