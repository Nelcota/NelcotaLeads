import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./drizzle");
  return {
    resolve: { tsconfigPaths: true },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "node",
            include: ["src/**/*.test.ts"],
            exclude: ["src/**/*.worker.test.ts"],
          },
        },
        {
          extends: true,
          plugins: [
            cloudflareTest({
              main: "./test/worker.ts",
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            }),
          ],
          test: {
            name: "workers",
            include: ["src/**/*.worker.test.ts"],
            setupFiles: ["./test/apply-migrations.ts"],
          },
        },
      ],
    },
  };
});
