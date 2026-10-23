# share

Publish files and multi-file HTML demos at a public URL, from any machine, by any agent. R2 stores the files; one Worker serves them, accepts uploads, and shows an admin list. Infra is [Alchemy](https://alchemy.run) v2.

```bash
bun skills/share/scripts/share.ts put ./demo --ns myrepo/demos
# https://share.mark-life.com/myrepo/demos/demo-k3f9/
```

## How it works

- Keys are `<namespace>/<slug>-<random4>/<file>`. A `_meta.json` in each prefix marks it as a share.
- `GET /<path>/` serves `index.html`; `/<path>` redirects to `/<path>/` when it is a folder. HTML is `no-cache`, other files are cached for an hour. Byte ranges work, so videos seek.
- `/_api/*` takes uploads, lists, and deletes, with `Authorization: Bearer $SHARE_TOKEN`.
- `/_admin` lists every share by namespace, behind basic auth (any user, `SHARE_TOKEN` as password).
- An R2 lifecycle rule deletes everything under `junk/` after 30 days.

## Deploy

```bash
bun install
SHARE_TOKEN=... bun run deploy   # alchemy deploy --stage prod
```

State lives in Cloudflare (`Cloudflare.state()`), so any machine logged in with `alchemy profile` can deploy.

## Agent skill

`skills/share/` is the skill: `SKILL.md` plus a zero-dependency Bun CLI. Install with:

```bash
bunx skills add mark-life/share
```

The CLI reads `SHARE_URL` and `SHARE_TOKEN` from the environment or `~/.agents/.env.local`.
