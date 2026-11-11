// Builds the read-only demo as plain static files in frontend/out.
//
//   node scripts/build_demo.mjs [base-path]
//
// base-path is where the site will be served from, e.g. /codeatlas. Run
// scripts/snapshot_demo.mjs first so frontend/public/demo exists. See docs/demo.md.
import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend");
const basePath = (process.argv[2] || "").replace(/\/$/, "");
if (!existsSync(join(frontend, "public", "demo", "base.json")))
  throw new Error("No demo data. Run scripts/snapshot_demo.mjs against a running API first.");

// The password gate in proxy.ts needs a server, which a static export does not
// have, and Next.js refuses to export with it present. Set it aside for the build.
const proxy = join(frontend, "proxy.ts");
const aside = join(frontend, "proxy.ts.demo-skip");
renameSync(proxy, aside);
try {
  execSync("npx next build", {
    cwd: frontend,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: "1" },
  });
} finally {
  renameSync(aside, proxy);
}
console.log(`Demo built in ${join(frontend, "out")} for base path "${basePath || "/"}".`);
