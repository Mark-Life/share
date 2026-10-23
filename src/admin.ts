import { JUNK_NS, META_FILE, type ShareMeta } from "../skills/share/scripts/meta.ts";
import type { Env } from "./worker.ts";

interface ShareRow {
  prefix: string;
  files: number;
  bytes: number;
  meta: ShareMeta | undefined;
}

const timingSafeEqual = (a: string, b: string) => {
  const enc = new TextEncoder();
  const [x, y] = [enc.encode(a), enc.encode(b)];
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
};

const unauthorized = () =>
  new Response("Unauthorized", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="share admin"' },
  });

const isAuthorized = (request: Request, password: string) => {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = atob(header.slice("Basic ".length));
  return timingSafeEqual(decoded.slice(decoded.indexOf(":") + 1), password);
};

const listAll = async (bucket: R2Bucket) => {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
};

const collectShares = async (bucket: R2Bucket) => {
  const objects = await listAll(bucket);
  const prefixes = objects
    .filter((o) => o.key.endsWith(`/${META_FILE}`))
    .map((o) => o.key.slice(0, -META_FILE.length));

  return Promise.all(
    prefixes.map(async (prefix): Promise<ShareRow> => {
      const inside = objects.filter((o) => o.key.startsWith(prefix) && !o.key.endsWith(META_FILE));
      const meta = await bucket.get(`${prefix}${META_FILE}`).then((o) => o?.json<ShareMeta>());
      return {
        prefix,
        files: inside.length,
        bytes: inside.reduce((sum, o) => sum + o.size, 0),
        meta,
      };
    })
  );
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const formatBytes = (n: number) => {
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(Math.max(n, 1)) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const namespaceOf = (prefix: string) => prefix.split("/").slice(0, -2).join("/");

const renderRow = (row: ShareRow) => {
  const entry = row.meta?.entry === "index.html" ? "" : (row.meta?.entry ?? "");
  const href = `/${row.prefix}${entry}`;
  const slug = row.prefix.split("/").at(-2) ?? row.prefix;
  return `<tr>
    <td><a href="${escapeHtml(href)}">${escapeHtml(row.meta?.title ?? slug)}</a><div class="dim">${escapeHtml(slug)}</div></td>
    <td class="num">${row.files}</td>
    <td class="num">${formatBytes(row.bytes)}</td>
    <td>${escapeHtml(row.meta?.updatedAt.slice(0, 10) ?? "")}</td>
    <td class="dim">${escapeHtml(row.meta?.host ?? "")}</td>
  </tr>`;
};

const renderPage = (rows: ShareRow[]) => {
  const groups = Map.groupBy(rows, (r) => namespaceOf(r.prefix));
  const sections = [...groups.keys()]
    .sort()
    .map((ns) => {
      const items = (groups.get(ns) ?? []).toSorted((a, b) =>
        (b.meta?.updatedAt ?? "").localeCompare(a.meta?.updatedAt ?? "")
      );
      const note = ns === JUNK_NS || ns.startsWith(`${JUNK_NS}/`) ? ' <span class="dim">: deleted after 30 days</span>' : "";
      return `<h2>${escapeHtml(ns)}${note}</h2>
      <table><tr><th>Share</th><th class="num">Files</th><th class="num">Size</th><th>Updated</th><th>Host</th></tr>
      ${items.map(renderRow).join("")}</table>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>share admin</title><style>
body{font:14px/1.5 system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#222}
h2{margin-top:2rem;font-size:1rem}table{width:100%;border-collapse:collapse}
td,th{padding:.4rem .5rem;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
.num{text-align:right}.dim{color:#888;font-size:12px}a{color:#0645ad}
@media(prefers-color-scheme:dark){body{background:#111;color:#ddd}td,th{border-color:#333}a{color:#8ab4f8}}
</style></head><body><h1>share</h1><p class="dim">${rows.length} shares</p>${sections || "<p>No shares yet.</p>"}</body></html>`;
};

export const handleAdmin = async ({ request, env }: { request: Request; env: Env; url: URL }) => {
  if (!isAuthorized(request, env.ADMIN_PASSWORD)) return unauthorized();
  const rows = await collectShares(env.BUCKET);
  return new Response(renderPage(rows), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
};
