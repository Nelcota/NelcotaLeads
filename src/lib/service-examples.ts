/**
 * Example rows for the service table while the real prices are not defined (decided
 * 2026-11-03). Only the local seed writes them (`pnpm services:seed`), never a migration;
 * "Serviços e preços" warns while the table still holds exactly these prices.
 * No imports: the seed script runs this file on plain Node.
 */
export type ExampleService = {
  name: string;
  detail: string;
  priceCents: number;
  deadlineDays: number | null;
  monthly: boolean;
};

export type ExampleAddon = { name: string; scope: string; priceCents: number; monthly: boolean };

export const EXAMPLE_SERVICES: readonly ExampleService[] = [
  {
    name: "Site institucional",
    detail: "Até 5 páginas, formulário de contato e botão de WhatsApp",
    priceCents: 99_000,
    deadlineDays: 10,
    monthly: false,
  },
  {
    name: "Site com agendamento online",
    detail: "Site institucional com agenda de horários para os clientes",
    priceCents: 149_000,
    deadlineDays: 15,
    monthly: false,
  },
  {
    name: "Loja virtual",
    detail: "Catálogo, carrinho e pagamento online",
    priceCents: 249_000,
    deadlineDays: 25,
    monthly: false,
  },
  {
    name: "Gestão de redes sociais",
    detail: "Posts semanais no Instagram e no Facebook",
    priceCents: 69_000,
    deadlineDays: null,
    monthly: true,
  },
];

export const EXAMPLE_ADDONS: readonly ExampleAddon[] = [
  {
    name: "Domínio e e-mail profissional",
    scope: "Todos os sites",
    priceCents: 19_000,
    monthly: false,
  },
  { name: "Integração com WhatsApp", scope: "Todos os sites", priceCents: 25_000, monthly: false },
  { name: "Página extra", scope: "Todos os sites", priceCents: 15_000, monthly: false },
  {
    name: "Textos escritos pela Nelcota",
    scope: "Todos os sites",
    priceCents: 29_000,
    monthly: false,
  },
  { name: "Manutenção mensal", scope: "Todos os sites", priceCents: 12_000, monthly: true },
];
