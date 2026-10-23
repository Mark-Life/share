import { META_FILE } from "../skills/share/scripts/meta.ts";
import { handleAdmin } from "./admin.ts";
import { handleApi } from "./api.ts";

export interface Env {
  BUCKET: R2Bucket;
  /** Bearer token for `/_api`, and the password for `/_admin`. */
  SHARE_TOKEN: string;
}

const HTML_CACHE = "no-cache";
const ASSET_CACHE = "public, max-age=3600";
const ROBOTS = "User-agent: *\nDisallow: /\n";

const isHtml = (key: string) => /\.html?$/i.test(key);

const contentRange = (range: R2Range, size: number) => {
  const offset = "suffix" in range ? size - range.suffix : (range.offset ?? 0);
  const length = "length" in range && range.length !== undefined ? range.length : size - offset;
  return `bytes ${offset}-${offset + length - 1}/${size}`;
};

const notFound = () => new Response("Not found", { status: 404 });

const serveObject = async ({ request, env, url }: { request: Request; env: Env; url: URL }) => {
  const key = decodeURIComponent(url.pathname.slice(1));
  if (key === "" || key.split("/").pop() === META_FILE) return notFound();

  const target = key.endsWith("/") ? `${key}index.html` : key;
  const obj = await env.BUCKET.get(target, { range: request.headers, onlyIf: request.headers });

  if (!obj) {
    // `/demo` → `/demo/` so relative links in the page resolve inside the share
    const isDir = !key.endsWith("/") && (await env.BUCKET.head(`${key}/index.html`));
    return isDir ? Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301) : notFound();
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", isHtml(target) ? HTML_CACHE : ASSET_CACHE);
  headers.set("accept-ranges", "bytes");
  headers.set("x-robots-tag", "noindex");

  if (!("body" in obj)) return new Response(null, { status: 304, headers });

  const ranged = obj.range !== undefined && request.headers.has("range");
  if (ranged && obj.range) headers.set("content-range", contentRange(obj.range, obj.size));

  return new Response(request.method === "HEAD" ? null : obj.body, {
    status: ranged ? 206 : 200,
    headers,
  });
};

export default {
  fetch: async (request, env) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/_api/")) return handleApi({ request, env, url });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/robots.txt") return new Response(ROBOTS);
    if (url.pathname === "/_admin") return handleAdmin({ request, env, url });
    return serveObject({ request, env, url });
  },
} satisfies ExportedHandler<Env>;
