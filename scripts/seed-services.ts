/**
 * Fills the LOCAL D1 with the example service table (src/lib/service-examples.ts) while the
 * real prices are not defined. Runs on plain Node: `pnpm services:seed`.
 *
 *   pnpm services:seed                              local dev database (.wrangler/state)
 *   pnpm services:seed --persist-to .wrangler/e2e   another local database
 *
 * Only ever local: it refuses --remote, and every wrangler call carries --local. Rows have fixed
 * ids and are inserted with INSERT OR IGNORE, so running it twice changes nothing and a price
 * edited in the app is never overwritten.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { EXAMPLE_ADDONS, EXAMPLE_SERVICES } from "../src/lib/service-examples.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (process.argv.some((arg) => arg === "--remote" || arg.startsWith("--remote="))) {
  fail("services:seed only writes example prices to the local D1; --remote is not allowed.");
}

const { values: args } = parseArgs({ options: { "persist-to": { type: "string" } } });

// Wrangler's own entry point on this Node, so no shell parses the arguments (Windows included).
const WRANGLER = path.join(
  path.dirname(createRequire(import.meta.url).resolve("wrangler")),
  "../bin/wrangler.js",
);

function wrangler(...extra: string[]) {
  const target = args["persist-to"] ? ["--persist-to", args["persist-to"]] : [];
  const result = spawnSync(process.execPath, [WRANGLER, "d1", ...extra, "--local", ...target], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (result.status !== 0) fail(`wrangler d1 ${extra[0]} failed`);
}

const quote = (value: string | number | boolean | null) => {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
};
const row = (values: (string | number | boolean | null)[]) => `(${values.map(quote).join(", ")})`;

const serviceRows = EXAMPLE_SERVICES.map((service, index) =>
  row([
    `example-service-${index + 1}`,
    service.name,
    service.detail,
    service.priceCents,
    service.deadlineDays,
    service.monthly,
    index,
  ]),
);
const addonRows = EXAMPLE_ADDONS.map((addon, index) =>
  row([
    `example-addon-${index + 1}`,
    addon.name,
    addon.scope,
    addon.priceCents,
    addon.monthly,
    index,
  ]),
);
const sql = [
  `INSERT OR IGNORE INTO services (id, name, detail, price_cents, deadline_days, monthly, position) VALUES\n${serviceRows.join(",\n")};`,
  `INSERT OR IGNORE INTO service_addons (id, name, scope, price_cents, monthly, position) VALUES\n${addonRows.join(",\n")};`,
].join("\n");

// The tables have to exist first.
wrangler("migrations", "apply", "nelcota-leads");
const dir = mkdtempSync(path.join(tmpdir(), "nelcota-services-"));
try {
  const file = path.join(dir, "services.sql");
  writeFileSync(file, sql);
  wrangler("execute", "nelcota-leads", "--file", file);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  `Example table ready: ${EXAMPLE_SERVICES.length} services, ${EXAMPLE_ADDONS.length} add-ons (local D1).`,
);
