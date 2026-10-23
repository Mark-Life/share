import type { Env } from "./worker.ts";
import { timingSafeEqual } from "./auth.ts";

const OBJECT_PREFIX = "/_api/object/";
const LIST_LIMIT = 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isAuthorized = (request: Request, token: string) =>
  timingSafeEqual(request.headers.get("authorization") ?? "", `Bearer ${token}`);

const validKey = (key: string) =>
  key.length > 0 && !key.startsWith("/") && !key.split("/").some((s) => s === "" || s === "." || s === "..");

const handleObject = async ({ request, env, key }: { request: Request; env: Env; key: string }) => {
  if (!validKey(key)) return json({ error: "invalid key" }, 400);

  switch (request.method) {
    case "PUT": {
      if (!request.body) return json({ error: "empty body" }, 400);
      const contentType = request.headers.get("content-type") ?? "application/octet-stream";
      const obj = await env.BUCKET.put(key, request.body, { httpMetadata: { contentType } });
      return json({ key, size: obj.size });
    }
    case "GET": {
      const obj = await env.BUCKET.get(key);
      return obj ? new Response(obj.body) : json({ error: "not found" }, 404);
    }
    case "DELETE":
      await env.BUCKET.delete(key);
      return json({ key });
    default:
      return json({ error: "method not allowed" }, 405);
  }
};

const handleList = async ({ env, url }: { env: Env; url: URL }) => {
  const page = await env.BUCKET.list({
    prefix: url.searchParams.get("prefix") ?? "",
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: LIST_LIMIT,
  });
  return json({
    objects: page.objects.map((o) => ({ key: o.key, size: o.size })),
    cursor: page.truncated ? page.cursor : undefined,
  });
};

export const handleApi = async ({ request, env, url }: { request: Request; env: Env; url: URL }) => {
  if (!isAuthorized(request, env.SHARE_TOKEN)) return json({ error: "unauthorized" }, 401);
  if (url.pathname.startsWith(OBJECT_PREFIX)) {
    const key = url.pathname.slice(OBJECT_PREFIX.length).split("/").map(decodeURIComponent).join("/");
    return handleObject({ request, env, key });
  }
  if (url.pathname === "/_api/list" && request.method === "GET") return handleList({ env, url });
  return json({ error: "not found" }, 404);
};
