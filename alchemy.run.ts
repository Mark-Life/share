import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { JUNK_NS } from "./skills/share/scripts/meta.ts";

const JUNK_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export default Alchemy.Stack(
  "share",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.Bucket("Bucket", {
      name: "mark-life-share",
      lifecycleRules: [
        {
          id: "expire-junk",
          prefix: `${JUNK_NS}/`,
          deleteObjectsTransition: { condition: { type: "Age", maxAge: JUNK_MAX_AGE_SECONDS } },
        },
      ],
    });

    const worker = yield* Cloudflare.Worker("Worker", {
      name: "share",
      main: "./src/worker.ts",
      compatibility: { date: "2026-10-01" },
      env: {
        BUCKET: bucket,
        SHARE_TOKEN: Config.Redacted("SHARE_TOKEN"),
      },
    });

    return { url: worker.url, bucket: bucket.bucketName };
  })
);
