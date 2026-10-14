import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { getDb } from "@/db/client";
import { mailConfigured } from "@/lib/mail";
import { CRON_RUNS, loadSystemStatus } from "./job-runs";

/** Conta → Status: every background task with its derived state. */
export const getSystemStatus = createServerFn({ method: "GET" }).handler(() =>
  loadSystemStatus(getDb(), { mailConfigured: mailConfigured(env), scheduled: CRON_RUNS }),
);
