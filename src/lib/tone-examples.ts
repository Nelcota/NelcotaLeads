import type { SettingsInput } from "./schemas";

type Tone = SettingsInput["tone"];

/** The fictional lead every tone example writes to. */
export const TONE_EXAMPLE_LEAD = "Clínica Sorriso Pleno, Belo Horizonte";

/**
 * A fixed first e-mail per tone, so Configurações shows the difference without calling the AI.
 * Illustration only: the real e-mail is written per lead, from its analysis.
 */
export const TONE_EXAMPLES: Record<Tone, { subject: string; body: string }> = {
  formal: {
    subject: "Site para a Clínica Sorriso Pleno",
    body: "Prezada Dra. Marina,\n\nNotei que a Clínica Sorriso Pleno ainda não tem um site próprio, apenas o perfil no Google. Desenvolvemos sites com agendamento online para clínicas odontológicas.\n\nPosso enviar dois exemplos de clínicas de Belo Horizonte?\n\nAtenciosamente,\nEquipe Nelcota",
  },
  consultivo: {
    subject: "Quem procura dentista no Savassi não acha a Sorriso Pleno",
    body: "Dra. Marina, a Sorriso Pleno tem nota 4,8 no Google, com 212 avaliações, mas quem procura dentista no Savassi não encontra um site da clínica e acaba marcando com quem aparece primeiro.\n\nMontamos sites com agendamento online para clínicas da região. Quer ver como ficaria o da Sorriso Pleno?\n\nEquipe Nelcota",
  },
  direto: {
    subject: "Sorriso Pleno sem site",
    body: "Dra. Marina, a Sorriso Pleno não tem site. Fazemos um com agendamento online em 10 dias.\n\nEnvio um exemplo?\n\nEquipe Nelcota",
  },
};
