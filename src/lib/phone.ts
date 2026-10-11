import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normalizes a Brazilian phone number to E.164 (e.g. +5531999990000), or null if invalid. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "BR");
  return parsed?.isValid() ? parsed.number : null;
}

export function whatsappLink(e164: string, message?: string | null): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
