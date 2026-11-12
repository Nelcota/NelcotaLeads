import { notReadyReason, siteHost, type LeadRowFacts } from "@/lib/lead-row";

type HintLead = Pick<
  LeadRowFacts,
  "analysisStatus" | "signals" | "website" | "status" | "email" | "unsubscribedAt"
>;

/**
 * The second line under the name: the opportunity hook that decides whether to contact the lead,
 * or, for a new lead that cannot get the first e-mail yet, why not.
 * `tone` is a CSS color for the rare states that need one (a failed analysis).
 */
export function leadHint(lead: HintLead): { text: string; tone?: string } {
  if (lead.analysisStatus === "pending") return { text: "Analisando…" };
  if (lead.analysisStatus === "error") return { text: "Falha na análise", tone: "var(--red)" };
  if (lead.analysisStatus === "skipped") return { text: "Não analisado" };
  const reason = notReadyReason(lead);
  if (reason) return { text: reason };
  const signal = lead.signals?.[0];
  if (signal) return { text: signal };
  return { text: siteHost(lead.website) ?? "Sem site" };
}
