import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { experimental_readRawConfig } from "wrangler";

const root = import.meta.dirname;
const E2E_DIR = path.join(root, ".wrangler", "e2e");

// Real provider module → in-memory fake, swapped in only for the Playwright dev server.
const E2E_FAKES: Record<string, string> = {
  [path.join(root, "src/lib/ai/index.ts")]: path.join(root, "e2e/fakes/ai.ts"),
  [path.join(root, "src/lib/places/index.ts")]: path.join(root, "e2e/fakes/places.ts"),
  [path.join(root, "src/lib/mail/index.ts")]: path.join(root, "e2e/fakes/mail.ts"),
};

function e2eFakes(): Plugin {
  return {
    name: "nelcota:e2e-fakes",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved ? (E2E_FAKES[path.normalize(resolved.id)] ?? null) : null;
    },
  };
}

/**
 * The app's wrangler config with fixed test vars and no .dev.vars next to it, so the
 * developer's real keys and password never reach an E2E run.
 */
function writeE2eWranglerConfig(): string {
  const { rawConfig } = experimental_readRawConfig({ config: path.join(root, "wrangler.jsonc") });
  const config = {
    ...rawConfig,
    $schema: undefined,
    main: path.join(root, "src/server.ts"),
    triggers: { crons: [] },
    vars: {
      ...rawConfig.vars,
      APP_PASSWORD: "e2e-password",
      GOOGLE_PLACES_API_KEY: "fake",
      DEEPSEEK_API_KEY: "fake",
      MAIL_ADDRESS: "eu@nelcota.test",
      MAIL_PASSWORD: "fake",
    },
    d1_databases: rawConfig.d1_databases?.map((database: Record<string, unknown>) => ({
      ...database,
      migrations_dir: path.join(root, "drizzle"),
    })),
  };
  mkdirSync(E2E_DIR, { recursive: true });
  const file = path.join(E2E_DIR, "wrangler.json");
  writeFileSync(file, JSON.stringify(config, null, 2));
  return file;
}

export default defineConfig(({ command }) => {
  // Never in a build: production bundles can't contain the fakes or the E2E control route.
  const e2e = command === "serve" && process.env.E2E === "1";
  return {
    resolve: { tsconfigPaths: true },
    define: { NELCOTA_E2E: JSON.stringify(e2e) },
    plugins: [
      ...(e2e ? [e2eFakes()] : []),
      cloudflare({
        viteEnvironment: { name: "ssr" },
        ...(e2e ? { configPath: writeE2eWranglerConfig(), persistState: { path: E2E_DIR } } : {}),
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  };
});
