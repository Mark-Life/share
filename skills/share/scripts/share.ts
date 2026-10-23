#!/usr/bin/env bun
import { readdir, stat } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { S3Client } from "bun";
import { JUNK_NS, META_FILE, type ShareMeta } from "./meta.ts";

const ENV_FILE = join(homedir(), ".agents", ".env.local");
const ENV_KEYS = [
  "SHARE_URL",
  "SHARE_S3_ENDPOINT",
  "SHARE_BUCKET",
  "SHARE_ACCESS_KEY_ID",
  "SHARE_SECRET_ACCESS_KEY",
] as const;
const SKIP = new Set([".DS_Store", ".git", "node_modules", META_FILE]);
const CONCURRENCY = 8;
const SUFFIX_LENGTH = 4;

type EnvKey = (typeof ENV_KEYS)[number];
type Prefix = string & { __brand: "Prefix" };

const fail = (message: string): never => {
  console.error(`error: ${message}`);
  process.exit(1);
};

const parseEnvFile = (text: string) =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter((m) => m !== null)
      .map(([, key, value]) => [key, (value ?? "").replace(/^(["'])(.*)\1$/, "$2")])
  );

const loadConfig = async (envPath: string | undefined) => {
  const file = Bun.file(envPath ?? ENV_FILE);
  const fromFile = (await file.exists()) ? parseEnvFile(await file.text()) : {};
  const merged = { ...fromFile, ...process.env };
  const missing = ENV_KEYS.filter((k) => !merged[k]);
  if (missing.length > 0) fail(`${missing.join(", ")} must be set in ${ENV_FILE} or the environment`);
  return Object.fromEntries(ENV_KEYS.map((k) => [k, merged[k] as string])) as Record<EnvKey, string>;
};

interface ListPage {
  objects: { key: string; size: number }[];
  cursor?: string;
}

/** R2 over its S3 API, so uploads go straight to storage and skip the Worker. */
const makeClient = (config: Record<EnvKey, string>) => {
  const s3 = new S3Client({
    accessKeyId: config.SHARE_ACCESS_KEY_ID,
    secretAccessKey: config.SHARE_SECRET_ACCESS_KEY,
    endpoint: config.SHARE_S3_ENDPOINT,
    bucket: config.SHARE_BUCKET,
  });

  return {
    put: async ({ key, body, type }: { key: string; body: Blob | string; type: string }) => {
      await s3.write(key, body, { type });
    },
    get: async (key: string) => {
      const file = s3.file(key);
      return (await file.exists()) ? file : undefined;
    },
    delete: (key: string) => s3.delete(key),
    list: async ({ prefix, cursor }: { prefix: string; cursor: string | undefined }): Promise<ListPage> => {
      const page = await s3.list({ prefix, continuationToken: cursor, maxKeys: 1000 });
      return {
        objects: (page.contents ?? []).map((o) => ({ key: o.key, size: o.size ?? 0 })),
        cursor: page.isTruncated ? page.nextContinuationToken : undefined,
      };
    },
  };
};

type Client = ReturnType<typeof makeClient>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "share";

const randomSuffix = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH)), (b) => (b % 36).toString(36)).join("");

const parseNamespace = (ns: string) => {
  const clean = ns.replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/.test(clean)) {
    fail(`invalid namespace "${ns}": use lowercase segments like "thinkrail/pr"`);
  }
  return clean;
};

/** `ns/slug` → `ns/slug/`, the key prefix that holds one share. */
const parsePrefix = (ref: string) => {
  const clean = parseNamespace(ref);
  if (!clean.includes("/")) fail(`"${ref}" is not a share: expected <namespace>/<slug>`);
  return `${clean}/` as Prefix;
};

const shareUrl = ({ base, prefix, entry }: { base: string; prefix: Prefix; entry: string }) =>
  `${base.replace(/\/+$/, "")}/${prefix.split("/").map(encodeURIComponent).join("/")}${
    entry === "index.html" ? "" : entry.split("/").map(encodeURIComponent).join("/")
  }`;

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((e) => !SKIP.has(e.name))
      .map((e) => {
        const path = join(dir, e.name);
        if (e.isDirectory()) return walk(path);
        return e.isFile() ? Promise.resolve([path]) : Promise.resolve([]);
      })
  );
  return nested.flat();
};

interface Upload {
  path: string;
  key: string;
}

/** Each input dir uploads its contents; each input file lands at the share root. */
const collectUploads = async (inputs: string[]) => {
  const groups = await Promise.all(
    inputs.map(async (input) => {
      const abs = resolve(input);
      const info = await stat(abs).catch(() => fail(`${input}: no such file or directory`));
      if (info.isDirectory()) {
        const files = await walk(abs);
        return files.map((path) => ({ path, key: relative(abs, path).split(sep).join("/") }));
      }
      return [{ path: abs, key: basename(abs) }];
    })
  );
  const uploads = groups.flat();
  const dupes = uploads.map((u) => u.key).filter((k, i, all) => all.indexOf(k) !== i);
  if (dupes.length > 0) fail(`two inputs map to the same file name: ${[...new Set(dupes)].join(", ")}`);
  if (uploads.length === 0) fail("nothing to upload");
  return uploads;
};

const pickEntry = (uploads: Upload[]) =>
  uploads.find((u) => u.key === "index.html")?.key ??
  (uploads.length === 1 ? uploads[0]?.key : undefined) ??
  uploads.find((u) => u.key.endsWith(".html") && !u.key.includes("/"))?.key ??
  uploads[0]?.key ??
  "";

const runPool = async <T>(items: T[], worker: (item: T) => Promise<void>) => {
  const queue = [...items];
  const lanes = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
  });
  await Promise.all(lanes);
};

const listKeys = async ({ client, prefix }: { client: Client; prefix: string }) => {
  const objects: ListPage["objects"] = [];
  let cursor: string | undefined;
  do {
    const page = await client.list({ prefix, cursor });
    objects.push(...page.objects);
    cursor = page.cursor;
  } while (cursor);
  return objects;
};

const readMeta = async ({ client, prefix }: { client: Client; prefix: string }) => {
  const res = await client.get(`${prefix}${META_FILE}`);
  return res ? ((await res.json()) as ShareMeta) : undefined;
};

const put = async ({
  client,
  config,
  inputs,
  ns,
  name,
  to,
  title,
  exact,
}: {
  client: Client;
  config: Record<EnvKey, string>;
  inputs: string[];
  ns: string | undefined;
  name: string | undefined;
  to: string | undefined;
  title: string | undefined;
  exact: boolean;
}) => {
  if (inputs.length === 0) fail("put needs at least one file or directory");
  if (to && (ns || name)) fail("--to replaces an existing share; do not combine it with --ns or --name");

  const uploads = await collectUploads(inputs);
  const firstInput = basename(resolve(inputs[0] ?? ""));
  const prefix = to
    ? parsePrefix(to)
    : (`${parseNamespace(ns ?? JUNK_NS)}/${slugify(name ?? firstInput)}${exact ? "" : `-${randomSuffix()}`}/` as Prefix);

  // without the suffix two puts can land on one prefix; `--to` is the explicit overwrite
  if (exact && !to && (await listKeys({ client, prefix })).length > 0) {
    fail(`${prefix.slice(0, -1)} already exists: use --to ${prefix.slice(0, -1)} to replace it`);
  }

  const previous = to ? await readMeta({ client, prefix }) : undefined;
  if (to && !previous) fail(`no share at ${to}: run "share ls" to find it`);
  const stale = to ? await listKeys({ client, prefix }) : [];

  await runPool(uploads, async ({ path, key }) => {
    const file = Bun.file(path);
    await client.put({ key: `${prefix}${key}`, body: file, type: file.type });
  });

  const keep = new Set(uploads.map((u) => `${prefix}${u.key}`));
  await runPool(
    stale.filter((o) => !keep.has(o.key) && !o.key.endsWith(META_FILE)),
    (o) => client.delete(o.key)
  );

  const now = new Date().toISOString();
  const meta: ShareMeta = {
    title: title ?? previous?.title ?? firstInput,
    entry: pickEntry(uploads),
    source: inputs.map((i) => resolve(i)).join(", "),
    host: hostname().replace(/\.local$/, ""),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  await client.put({ key: `${prefix}${META_FILE}`, body: JSON.stringify(meta, null, 2), type: "application/json" });

  console.log(shareUrl({ base: config.SHARE_URL, prefix, entry: meta.entry }));
};

const ls = async ({
  client,
  config,
  filter,
  json,
}: {
  client: Client;
  config: Record<EnvKey, string>;
  filter: string | undefined;
  json: boolean;
}) => {
  const objects = await listKeys({ client, prefix: filter ? `${parseNamespace(filter)}/` : "" });
  const prefixes = objects
    .filter((o) => o.key.endsWith(`/${META_FILE}`))
    .map((o) => o.key.slice(0, -META_FILE.length) as Prefix);

  const rows = await Promise.all(
    prefixes.map(async (prefix) => {
      const meta = await readMeta({ client, prefix });
      const files = objects.filter((o) => o.key.startsWith(prefix) && !o.key.endsWith(META_FILE));
      return {
        ref: prefix.slice(0, -1),
        url: shareUrl({ base: config.SHARE_URL, prefix, entry: meta?.entry ?? "" }),
        files: files.length,
        bytes: files.reduce((sum, o) => sum + o.size, 0),
        ...meta,
      };
    })
  );
  const sorted = rows.toSorted((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  if (json) return console.log(JSON.stringify(sorted, null, 2));
  for (const r of sorted) {
    console.log([r.ref, r.url, r.files, r.bytes, r.updatedAt?.slice(0, 10) ?? "-", r.title ?? "-"].join("\t"));
  }
};

const rm = async ({ client, ref }: { client: Client; ref: string | undefined }) => {
  if (!ref) fail("rm needs <namespace>/<slug>");
  const prefix = parsePrefix(ref ?? "");
  if (!(await readMeta({ client, prefix }))) fail(`no share at ${ref}: run "share ls" to find it`);
  const objects = await listKeys({ client, prefix });
  // meta goes last so a failed run still shows up in `ls` and can be retried
  const [meta, rest] = [objects.filter((o) => o.key.endsWith(META_FILE)), objects.filter((o) => !o.key.endsWith(META_FILE))];
  await runPool(rest, (o) => client.delete(o.key));
  await runPool(meta, (o) => client.delete(o.key));
  console.log(`deleted ${ref} (${objects.length} objects)`);
};

const HELP = `share: publish files and folders to a public URL

  share put <path...> [--ns <namespace>] [--name <slug>] [--title <text>] [--exact]
  share put <path...> --to <namespace>/<slug>      replace an existing share, same URL
  share ls [namespace] [--json]
  share rm <namespace>/<slug>

--exact drops the random suffix: guessable URL, fails if the slug is taken.
--ns defaults to "${JUNK_NS}", which is deleted after 30 days.
Global: --env <path> reads credentials from another env file.`;

const main = async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ns: { type: "string" },
      name: { type: "string" },
      to: { type: "string" },
      title: { type: "string" },
      exact: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      env: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...args] = positionals;
  if (values.help || !command) return console.log(HELP);

  const config = await loadConfig(values.env);
  const client = makeClient(config);

  switch (command) {
    case "put":
      return put({ client, config, inputs: args, ns: values.ns, name: values.name, to: values.to, title: values.title, exact: values.exact });
    case "ls":
      return ls({ client, config, filter: args[0], json: values.json });
    case "rm":
      return rm({ client, ref: args[0] });
    default:
      return fail(`unknown command "${command}"\n\n${HELP}`);
  }
};

await main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
