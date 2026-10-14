import { defineConfig, devices } from "@playwright/test";

// Override to run a second suite (e.g. from a git worktree) beside one already on 3100.
const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * E2E against the real app on `vite dev`, with Google Places, DeepSeek and the mailbox
 * swapped for in-memory fakes (E2E=1, see vite.config.ts) and its own local D1 state.
 */
export default defineConfig({
  testDir: "./e2e",
  // One dev server and one database: files run one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/session.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `pnpm exec wrangler d1 migrations apply nelcota-leads --local --persist-to .wrangler/e2e && pnpm exec vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/login`,
    env: { E2E: "1" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
