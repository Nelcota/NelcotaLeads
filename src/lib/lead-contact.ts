import { z } from "zod";
import { toE164 } from "@/lib/phone";
import { safeHttpUrl } from "@/lib/utils";

/** The contact data a person can type in for a lead (panel edit, "Adicionar lead"). */
export const CONTACT_FIELDS = ["name", "email", "phone", "website"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export const CONTACT_LIMITS: Record<ContactField, number> = {
  name: 200,
  email: 254,
  phone: 40,
  website: 2048,
};

export type ContactPatch = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
  website?: string | null;
  siteStatus?: "pending" | "none";
};

const emailSchema = z.email();

/**
 * Turns what was typed into the columns to store, or throws a message for the user. An empty
 * value clears the field (except the name). E-mails are stored lowercase, phones need to be a
 * valid Brazilian number and sites an http(s) address ("padaria.com.br" gets https://).
 */
export function contactPatch(field: ContactField, raw: string): ContactPatch {
  const value = raw.normalize("NFC").trim();
  if (value.length > CONTACT_LIMITS[field]) throw new Error("Texto longo demais.");
  switch (field) {
    case "name":
      if (!value) throw new Error("Informe o nome.");
      return { name: value };
    case "email":
      if (!value) return { email: null };
      if (!emailSchema.safeParse(value).success) throw new Error("E-mail inválido.");
      return { email: value.toLowerCase() };
    case "phone": {
      if (!value) return { phone: null, phoneE164: null };
      const e164 = toE164(value);
      if (!e164) throw new Error("Telefone inválido. Use o DDD, ex.: (31) 99876-5432.");
      return { phone: value, phoneE164: e164 };
    }
    case "website":
      break;
  }
  if (!value) return { website: null, siteStatus: "none" };
  const url = safeHttpUrl(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
  if (!url || !new URL(url).hostname.includes(".")) {
    throw new Error("Site inválido. Ex.: padaria.com.br");
  }
  // Read again on the next analysis.
  return { website: url, siteStatus: "pending" };
}
