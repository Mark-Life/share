Bun project. `bun run typecheck` checks the CLI and infra (`tsconfig.json`) and the Worker (`src/tsconfig.json`, workers types).

- `alchemy.run.ts`: R2 bucket + Worker. Deploy with `bun run deploy`; needs `SHARE_ADMIN_PASSWORD` in env.
- `src/`: the Worker. Public file serving and `/_admin` (basic auth). It never takes uploads: the CLI writes to R2 over S3.
- `skills/share/`: the agent skill. Its CLI must stay dependency-free so the skill works when installed alone.
- Local test: `bunx wrangler dev` against a config in gitignored `.scratch/` with an R2 binding `BUCKET` and var `ADMIN_PASSWORD`.
