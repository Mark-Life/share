# share

Publish files and multi-file HTML demos at a public URL, from any machine, by any agent. The CLI uploads straight to R2 over its S3 API; one Worker serves the files and shows an admin list. Infra is [Alchemy](https://alchemy.run) v2.

```bash
bun skills/share/scripts/share.ts put ./demo --ns myrepo/demos
# https://share.mark-life.com/myrepo/demos/demo-k3f9/
```

## How it works

- Keys are `<namespace>/<slug>-<random4>/<file>`. A `_meta.json` in each prefix marks it as a share.
- `GET /<path>/` serves `index.html`; `/<path>` redirects to `/<path>/` when it is a folder. HTML is `no-cache`, other files are cached for an hour. Byte ranges work, so videos seek.
- `/_admin` lists every share by namespace, behind basic auth (any user, `SHARE_ADMIN_PASSWORD` as password).
- An R2 lifecycle rule deletes everything under `junk/` after 30 days.

## Deploy

```bash
bun install
SHARE_ADMIN_PASSWORD=... bun run deploy   # alchemy deploy --stage prod
```

State lives in Cloudflare (`Cloudflare.state()`), so any machine logged in with `alchemy profile` can deploy.

## Agent skill

`skills/share/` is the skill: `SKILL.md` plus a zero-dependency Bun CLI. Install with:

```bash
bunx skills add mark-life/share
```

The CLI reads `SHARE_URL`, `SHARE_S3_ENDPOINT`, `SHARE_BUCKET`, `SHARE_ACCESS_KEY_ID` and `SHARE_SECRET_ACCESS_KEY` from the environment or `~/.agents/.env.local`. The keys come from an R2 API token (Object Read & Write, scoped to the bucket), made in the dashboard under R2 > Manage API tokens.
