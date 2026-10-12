import type { LeadAnalyzer } from "../../src/lib/ai/analyzer";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { takeFault } from "./faults";

export type { CallUsage, LeadAnalyzer } from "../../src/lib/ai/analyzer";
export type { LeadContext } from "../../src/lib/ai/prompts";

const good = createFakeAnalyzer(80);
const poor = createFakeAnalyzer(10);

/** E2E stand-in for DeepSeek: odd-numbered companies score 80, even ones 10 (below the minimum). */
export function getAnalyzer(_env: unknown): LeadAnalyzer {
  return {
    ...good,
    analyze: (settings, lead) => (/[13579]$/.test(lead.name) ? good : poor).analyze(settings, lead),
    writeEmail: (settings, lead, analysis) => {
      if (takeFault("writeEmail")) return Promise.reject(new Error("DeepSeek: falha simulada"));
      return good.writeEmail(settings, lead, analysis);
    },
  };
}
