#!/usr/bin/env node
/**
 * 飞书 → 本地 Markdown 同步脚本
 *
 * 数据源（都是飞书多维表格 Bitable，字段说明见 docs/feishu-setup.md）：
 *   - 作品表：每行一个作品，正文可以是长文本 Markdown，或「详情文档」字段链接一篇飞书文档
 *   - 文章表：每行一篇文章，正文逻辑同上
 *
 * 环境变量：
 *   FEISHU_APP_ID / FEISHU_APP_SECRET   飞书自建应用凭证
 *   FEISHU_WORKS_APP_TOKEN / FEISHU_WORKS_TABLE_ID    作品多维表格
 *   FEISHU_POSTS_APP_TOKEN / FEISHU_POSTS_TABLE_ID    文章多维表格
 *
 * 用法：node scripts/feishu-sync.mjs
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://open.feishu.cn/open-apis';
const ROOT = path.resolve(import.meta.dirname, '..');
const WORKS_DIR = path.join(ROOT, 'src/content/works');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const ASSET_DIR = path.join(ROOT, 'public/feishu');

let TOKEN = '';

async function feishu(method, url, body, raw = false) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`飞书 API 出错 ${url}: ${data.code} ${data.msg}`);
  }
  return data.data;
}

async function getToken() {
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取 token 失败: ${data.msg}`);
  TOKEN = data.tenant_access_token;
}

// ---------- 多维表格 ----------

// Secret 里可以直接粘贴多维表格链接（知识库 /wiki/ 或 /base/ 链接），也可以填纯 app_token
async function resolveAppToken(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const w = s.match(/\/wiki\/([A-Za-z0-9]+)/);
  if (w) {
    const data = await feishu(
      'GET',
      `${BASE}/wiki/v2/spaces/get_node?token=${w[1]}&obj_type=wiki`
    );
    const node = data.node;
    if (node?.obj_type !== 'bitable') {
      throw new Error(`这个链接不是多维表格（实际是 ${node?.obj_type ?? '未知类型'}）：${s}`);
    }
    return node.obj_token;
  }
  const b = s.match(/\/base\/([A-Za-z0-9]+)/);
  if (b) return b[1];
  return s;
}

// 表 ID 的 Secret 可以直接填表名（如「作品表」），也可以填 tbl 开头的 ID
async function resolveTableId(appToken, v, fallbackName) {
  const s = String(v ?? '').trim() || fallbackName;
  if (/^tbl[A-Za-z0-9]+$/.test(s)) return s;
  const data = await feishu('GET', `${BASE}/bitable/v1/apps/${appToken}/tables?page_size=100`);
  const hit = (data.items ?? []).find((t) => t.name === s);
  if (!hit) {
    const names = (data.items ?? []).map((t) => `「${t.name}」`).join('、');
    throw new Error(`表里找不到「${s}」，现有数据表：${names || '（无）'}。请检查表名或改填 tbl 开头的表 ID`);
  }
  return hit.table_id;
}

async function listRecords(appToken, tableId) {
  const records = [];
  let pageToken;
  do {
    const url = new URL(
      `${BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`
    );
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const data = await feishu('GET', url);
    records.push(...(data.items ?? []));
    pageToken = data.page_token;
  } while (pageToken);
  return records;
}

// 从飞书文档链接里取 document_id，支持新旧两种链接格式
// 链接字段值可能是字符串、{text, link} 对象或数组，统一取 URL
function linkOf(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0]?.link ?? null;
  return v.link ?? v.text_run?.link?.url ?? null;
}

// 从飞书文档链接取 document_id；知识库链接（/wiki/）要先解析成实际文档 token
async function resolveDocLink(link) {
  if (!link) return null;
  const m =
    link.match(/\/docx\/([A-Za-z0-9]+)/) ||
    link.match(/\/docs\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  const w = link.match(/\/wiki\/([A-Za-z0-9]+)/);
  if (w) {
    const data = await feishu(
      'GET',
      `${BASE}/wiki/v2/spaces/get_node?token=${w[1]}&obj_type=wiki`
    );
    const node = data.node;
    if (node?.obj_type !== 'docx') {
      console.warn(`⚠️ 链接指向的不是文档（${node?.obj_type ?? '未知类型'}），已忽略: ${link}`);
      return null;
    }
    return node.obj_token;
  }
  return null;
}

// ---------- 文档块 → Markdown ----------

async function docToMarkdown(docId) {
  const data = await feishu(
    'GET',
    `${BASE}/docx/v1/documents/${docId}/blocks?page_size=500&document_revision_id=-1`
    );
  const blocks = data.items ?? [];
  const byId = new Map(blocks.map((b) => [b.block_id, b]));
  const root = blocks.find((b) => b.block_type === 1);
  if (!root) return '';

  const lines = [];
  const images = [];
  for (const id of root.children ?? []) walk(byId.get(id));

  function walk(block) {
    if (!block) return;
    switch (block.block_type) {
      case 2: // text
        lines.push(runsToMd(block.text));
        break;
      case 3: case 4: case 5: case 6: case 7: case 8: case 9: case 10: case 11: {
        const level = block.block_type - 2; // heading1..9
        lines.push(`${'#'.repeat(Math.min(level, 6))} ${runsToMd(block[headingKey(level)])}`);
        break;
      }
      case 12: // bullet
        lines.push(`- ${runsToMd(block.bullet)}`);
        break;
      case 13: // ordered
        lines.push(`1. ${runsToMd(block.ordered)}`);
        break;
      case 14: // code
        lines.push('```', runsToMd(block.code), '```');
        break;
      case 15: // quote
        lines.push(`> ${runsToMd(block.quote)}`);
        break;
      case 17: // todo
        lines.push(`- [${block.todo.style.done ? 'x' : ' '}] ${runsToMd(block.todo)}`);
        break;
      case 22: // divider
        lines.push('---');
        break;
      case 27: // image
        images.push(block.image.token);
        lines.push(`![${block.image.token}](/feishu/${block.image.token}.png)`);
        break;
      case 19: { // callout → 引用块，递归处理子块
        lines.push('> [!NOTE]');
        for (const id of block.callout?.children ?? []) {
          const child = byId.get(id);
          if (child?.block_type === 2) lines.push(`> ${runsToMd(child.text)}`);
        }
        break;
      }
      default:
        break;
    }
  }

  function headingKey(level) {
    return `heading${Math.min(level, 9)}`;
  }

  // 样式标记内的首尾空格会让 Markdown 不识别（如 **文字 **），把空格挪到标记外
  function styled(text, mark) {
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : text;
  }

  function runsToMd(container) {
    if (!container) return '';
    return (container.elements ?? [])
      .map((el) => {
        const run = el.text_run;
        if (!run) return '';
        let text = run.content;
        const style = run.text_element_style ?? {};
        if (style.inline_code) text = styled(text, '`');
        if (style.bold) text = styled(text, '**');
        if (style.italic) text = styled(text, '*');
        if (style.strikethrough) text = styled(text, '~~');
        if (style.link?.url) text = `[${text}](${style.link.url})`;
        return text;
      })
      .join('');
  }

  // 下载正文里引用的图片
  for (const token of new Set(images)) {
    await downloadFile(token, path.join(ASSET_DIR, `${token}.png`));
  }

  // 过滤「飞书剪存」自动生成的头部水印（原文链接/剪存时间/一键生成）
  const clipNoise = [/^>\s*🔗\s*原文链接/, /^>\s*⏰\s*剪存时间/, /^>\s*✂️\s*本文档由/];
  return lines
    .filter((l) => !clipNoise.some((re) => re.test(l)))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- 附件下载 ----------

async function downloadFile(fileToken, savePath) {
  if (existsSync(savePath)) return;
  // 优先拿临时下载链接，失败则直接走 download 接口
  let url;
  try {
    const data = await feishu(
      'POST',
      `${BASE}/drive/v1/medias/batch_get_tmp_download_url`,
      { file_tokens: [fileToken] }
    );
    url = data.tmp_download_urls?.[fileToken]?.tmp_download_url;
  } catch {
    // ignore
  }
  let res = url
    ? await fetch(url)
    : await feishu('GET', `${BASE}/drive/v1/medias/${fileToken}/download`, null, true);
  if (!res.ok && !url) {
    res = await fetch(url ?? `${BASE}/drive/v1/medias/${fileToken}/download`);
  }
  if (!res.ok) throw new Error(`下载文件失败 ${fileToken}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(savePath, buf);
}

function extOf(name = '', fallback = 'png') {
  const m = name.match(/\.(png|jpe?g|gif|webp|svg|avif)$/i);
  return m ? m[1].toLowerCase() : fallback;
}

function slugify(title, recordId) {
  const s = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // 中文会被保留，文件系统没问题；纯中文标题直接用短 id 更稳
  return /^[一-龥-]+$/.test(s) && s.length > 24 ? recordId.replace('rec', '') : s || recordId.replace('rec', '');
}

function fm(obj) {
  const props = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) =>
      Array.isArray(v) ? `${k}: [${v.map((x) => JSON.stringify(x)).join(', ')}]` : `${k}: ${JSON.stringify(v)}`
    );
  return `---\n${props.join('\n')}\n---\n\n`;
}

// ---------- 主流程 ----------

async function resolveCover(fields, recordId) {
  let cover = fields['封面'] ?? fields['cover'];
  if (Array.isArray(cover) && cover[0]?.file_token) {
    const att = cover[0];
    const file = `cover-${recordId}.${extOf(att.name)}`;
    await downloadFile(att.file_token, path.join(ASSET_DIR, file));
    cover = `/feishu/${file}`;
  }
  return cover;
}

async function main() {
  const need = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'];
  for (const k of need) {
    if (!process.env[k]) {
      console.error(`缺少环境变量 ${k}，参见 docs/feishu-setup.md`);
      process.exit(1);
    }
  }
  await getToken();
  await mkdir(ASSET_DIR, { recursive: true });

  const worksApp = await resolveAppToken(process.env.FEISHU_WORKS_APP_TOKEN);
  const worksTable = worksApp
    ? await resolveTableId(worksApp, process.env.FEISHU_WORKS_TABLE_ID, '作品表')
    : null;
  const postsApp = await resolveAppToken(process.env.FEISHU_POSTS_APP_TOKEN);
  const postsTable = postsApp
    ? await resolveTableId(postsApp, process.env.FEISHU_POSTS_TABLE_ID, '文章表')
    : null;

  let changed = 0;

  // 作品
  if (worksApp && worksTable) {
    const records = await listRecords(worksApp, worksTable);
    await rm(WORKS_DIR, { recursive: true, force: true });
    await mkdir(WORKS_DIR, { recursive: true });
    for (const r of records) {
      const f = r.fields;
      if (f['发布'] === false || f['published'] === false) continue;
      const title = f['标题'] ?? f['title'];
      if (!title) continue;

      const cover = await resolveCover(f, r.record_id);

      const tags = f['标签'] ?? f['tags'] ?? [];
      let body = f['正文'] ?? f['content'] ?? '';
      const detailLink = linkOf(f['详情文档']);
      const docId = await resolveDocLink(detailLink);
      if (docId) body = await docToMarkdown(docId);
      else if (detailLink && !String(body).trim()) {
        console.warn(`⚠️ 作品《${String(title).trim()}》的「详情文档」链接无效，正文为空`);
      }

      const slug = f['slug'] || slugify(title, r.record_id);
      const front = fm({
        title: String(title).trim(),
        description: String(f['简介'] ?? f['description'] ?? '').trim(),
        cover,
        tags,
        client: f['客户'] ?? f['client'] ?? undefined,
        year: String(f['年份'] ?? f['year'] ?? new Date().getFullYear()),
        link: f['链接'] ?? f['link'] ?? undefined,
        featured: Boolean(f['精选'] ?? f['featured'] ?? false),
        pubDate: f['日期'] ?? f['pubDate'] ?? new Date().toISOString().slice(0, 10),
      });
      await writeFile(path.join(WORKS_DIR, `${slug}.md`), front + body + '\n');
      changed++;
    }
    console.log(`✓ 作品同步完成：${changed} 条`);
  } else {
    console.log('· 未配置作品表，跳过');
  }

  // 文章
  if (postsApp && postsTable) {
    const records = await listRecords(postsApp, postsTable);
    await rm(POSTS_DIR, { recursive: true, force: true });
    await mkdir(POSTS_DIR, { recursive: true });
    let n = 0;
    for (const r of records) {
      const f = r.fields;
      if (f['发布'] === false || f['published'] === false) continue;
      const title = f['标题'] ?? f['title'];
      if (!title) continue;

      const cover = await resolveCover(f, r.record_id);
      let body = f['正文'] ?? f['content'] ?? '';
      const docLink = linkOf(f['文档']);
      const docId = await resolveDocLink(docLink);
      if (docId) {
        body = await docToMarkdown(docId);
        const front = fm({
          title: String(title).trim(),
          description: String(f['简介'] ?? f['description'] ?? '').trim(),
          cover,
          tags: f['标签'] ?? f['tags'] ?? [],
          pubDate: f['日期'] ?? f['pubDate'] ?? new Date().toISOString().slice(0, 10),
          feishuUrl: docLink,
        });
        const slug = f['slug'] || slugify(title, r.record_id);
        await writeFile(path.join(POSTS_DIR, `${slug}.md`), front + body + '\n');
        n++;
      } else if (body.trim()) {
        const front = fm({
          title: String(title).trim(),
          description: String(f['简介'] ?? f['description'] ?? '').trim(),
          cover,
          tags: f['标签'] ?? f['tags'] ?? [],
          pubDate: f['日期'] ?? f['pubDate'] ?? new Date().toISOString().slice(0, 10),
        });
        const slug = f['slug'] || slugify(title, r.record_id);
        await writeFile(path.join(POSTS_DIR, `${slug}.md`), front + body + '\n');
        n++;
      } else if (docLink) {
        console.warn(`⚠️ 文章《${String(title).trim()}》的「文档」链接无效，已跳过`);
      }
    }
    console.log(`✓ 文章同步完成：${n} 条`);
  } else {
    console.log('· 未配置文章表，跳过');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
