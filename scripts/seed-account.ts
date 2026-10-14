/**
 * Creates or updates this machine's sign-in account in the local D1, from `account.local`
 * (gitignored). Runs on plain Node: `pnpm account:seed`.
 *
 *   pnpm account:seed                                   upsert the account in account.local
 *   pnpm account:seed --new --name "Ana" --email a@b.c  write account.local with a random
 *                                                       password first (never printed)
 *   pnpm account:seed --persist-to .wrangler/e2e        target another local database
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { hashPassword } from "../src/lib/password.ts";

const FILE = "account.local";
// No look-alike characters, so the password survives being read off a screen.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const { values: args } = parseArgs({
  options: {
    new: { type: "boolean", default: false },
    name: { type: "string" },
    email: { type: "string" },
    "persist-to": { type: "string" },
  },
});

function randomPassword(length = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function readAccount(): Record<string, string> {
  const entries = readFileSync(FILE, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1)]);
  return Object.fromEntries(entries);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

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

if (args.new) {
  if (existsSync(FILE)) fail(`${FILE} already exists; edit it or delete it first.`);
  if (!args.name || !args.email) fail("--new needs --name and --email.");
  writeFileSync(
    FILE,
    [
      "# This machine's sign-in for Nelcota Leads. Gitignored (*.local): never commit it.",
      "# `pnpm account:seed` creates or updates this account in the local D1.",
      `LOGIN_NAME=${args.name}`,
      `LOGIN_EMAIL=${args.email.trim().toLowerCase()}`,
      `LOGIN_PASSWORD=${randomPassword()}`,
      "",
    ].join("\n"),
  );
  console.log(`Wrote ${FILE} with a random password.`);
}

if (!existsSync(FILE))
  fail(`No ${FILE}. Create it with: pnpm account:seed --new --name ... --email ...`);
const { LOGIN_NAME: name, LOGIN_EMAIL: email, LOGIN_PASSWORD: password } = readAccount();
if (!name || !email || !password) fail(`${FILE} needs LOGIN_NAME, LOGIN_EMAIL and LOGIN_PASSWORD.`);
if (password.length < 8) fail("LOGIN_PASSWORD needs at least 8 characters.");

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sql = `INSERT INTO users (id, name, email, password_hash) VALUES (${[
  crypto.randomUUID(),
  name,
  email.toLowerCase(),
  await hashPassword(password),
]
  .map(quote)
  .join(", ")})
ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash;`;

// The users table has to exist first.
wrangler("migrations", "apply", "nelcota-leads");
const dir = mkdtempSync(path.join(tmpdir(), "nelcota-seed-"));
try {
  const file = path.join(dir, "account.sql");
  writeFileSync(file, sql);
  wrangler("execute", "nelcota-leads", "--file", file);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Account ready: ${name} <${email.toLowerCase()}>`);
