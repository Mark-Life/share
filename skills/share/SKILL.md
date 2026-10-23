---
name: share
description: "Use to publish a file or folder at a public URL: screenshots, GIFs, videos, or multi-file HTML demos for a PR, issue, doc, or message."
---

# Share

`scripts/share.ts` publishes files and folders to `share.mark-life.com` (R2 behind a Worker). A folder with `index.html` is served as a site, so relative CSS, JS, and assets work. Run it with Bun from the skill's `scripts/` dir:

```bash
bun share.ts put ./demo --ns thinkrail/demos --title "Extensions demo"
```

## Commands

| Command | What it does |
| --- | --- |
| `put <path...> [--ns <ns>] [--name <slug>] [--title <text>]` | New share at `<ns>/<slug>-<random4>/` and prints its URL. A dir uploads its contents, a file lands at the share root. `--name` defaults to the first input's name. |
| `put <path...> --to <ns>/<slug>` | Replaces an existing share in place: same URL, files missing from the new upload are deleted. Use it when updating something already linked. |
| `ls [ns] [--json]` | Shares, newest first: `ref\turl\tfiles\tbytes\tupdated\ttitle`. |
| `rm <ns>/<slug>` | Deletes one share and all its files. |

## Namespaces

Pick the namespace from what the share is for. Lowercase segments only:

- `<repo>/pr/<number>`: assets for a pull request.
- `<repo>/issues/<number>`: assets for an issue.
- `<project>/demos`: HTML demos and product explorations.
- `junk` (the default): throwaway how-tos and one-off links. **Deleted after 30 days**, so never put anything a PR or doc links to long-term here.

## Credentials

`SHARE_URL` and `SHARE_TOKEN` come from `~/.agents/.env.local`, overridden by the process environment or `--env <path>`. If the CLI says they must be set, report it as a setup gap and stop. Keep the token out of chat, logs, and files you write. The same token is the `/_admin` password, where the user browses all shares.

## Guardrails

- **Every share is public.** Anyone with the URL can open it. The random suffix keeps URLs unguessable and `robots.txt` blocks indexing, but nothing more. Publish what the user asked to share; for anything with secrets, customer data, or internal dashboards, ask first.
- **100 MB per file**: the Worker request limit. Compress larger videos first.
- **GitHub plays only its own video uploads inline.** A share `.mp4` shows as a link in PRs and issues. Images and GIFs embed fine with `![](url)`.

**Done when** the URL you report came from the command's own output and `curl -sS -o /dev/null -w '%{http_code}' "<url>"` returned `200`.
