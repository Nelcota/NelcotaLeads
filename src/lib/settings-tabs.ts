import { z } from "zod";

/** The Configurações tabs, in order; the id is the `?aba=` value. */
export const SETTINGS_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "email", label: "E-mail e envio" },
  { id: "automacao", label: "Automação" },
  { id: "ia", label: "IA e pontuação" },
  { id: "modelos", label: "Modelos e serviços" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export const DEFAULT_SETTINGS_TAB: SettingsTab = "resumo";

export const settingsTabSchema = z.enum(["resumo", "email", "automacao", "ia", "modelos"]);
