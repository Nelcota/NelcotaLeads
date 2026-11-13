/** The 27 federative units, by their two-letter code. */
export const STATE_CODES = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

export type StateCode = (typeof STATE_CODES)[number];

export const REGIONS = [
  { id: "norte", name: "Norte" },
  { id: "nordeste", name: "Nordeste" },
  { id: "centro-oeste", name: "Centro-Oeste" },
  { id: "sudeste", name: "Sudeste" },
  { id: "sul", name: "Sul" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export type BrazilState = {
  code: StateCode;
  name: string;
  capital: string;
  region: RegionId;
};

export const BRAZIL_STATES: readonly BrazilState[] = [
  { code: "AC", name: "Acre", capital: "Rio Branco", region: "norte" },
  { code: "AL", name: "Alagoas", capital: "Maceió", region: "nordeste" },
  { code: "AM", name: "Amazonas", capital: "Manaus", region: "norte" },
  { code: "AP", name: "Amapá", capital: "Macapá", region: "norte" },
  { code: "BA", name: "Bahia", capital: "Salvador", region: "nordeste" },
  { code: "CE", name: "Ceará", capital: "Fortaleza", region: "nordeste" },
  { code: "DF", name: "Distrito Federal", capital: "Brasília", region: "centro-oeste" },
  { code: "ES", name: "Espírito Santo", capital: "Vitória", region: "sudeste" },
  { code: "GO", name: "Goiás", capital: "Goiânia", region: "centro-oeste" },
  { code: "MA", name: "Maranhão", capital: "São Luís", region: "nordeste" },
  { code: "MG", name: "Minas Gerais", capital: "Belo Horizonte", region: "sudeste" },
  { code: "MS", name: "Mato Grosso do Sul", capital: "Campo Grande", region: "centro-oeste" },
  { code: "MT", name: "Mato Grosso", capital: "Cuiabá", region: "centro-oeste" },
  { code: "PA", name: "Pará", capital: "Belém", region: "norte" },
  { code: "PB", name: "Paraíba", capital: "João Pessoa", region: "nordeste" },
  { code: "PE", name: "Pernambuco", capital: "Recife", region: "nordeste" },
  { code: "PI", name: "Piauí", capital: "Teresina", region: "nordeste" },
  { code: "PR", name: "Paraná", capital: "Curitiba", region: "sul" },
  { code: "RJ", name: "Rio de Janeiro", capital: "Rio de Janeiro", region: "sudeste" },
  { code: "RN", name: "Rio Grande do Norte", capital: "Natal", region: "nordeste" },
  { code: "RO", name: "Rondônia", capital: "Porto Velho", region: "norte" },
  { code: "RR", name: "Roraima", capital: "Boa Vista", region: "norte" },
  { code: "RS", name: "Rio Grande do Sul", capital: "Porto Alegre", region: "sul" },
  { code: "SC", name: "Santa Catarina", capital: "Florianópolis", region: "sul" },
  { code: "SE", name: "Sergipe", capital: "Aracaju", region: "nordeste" },
  { code: "SP", name: "São Paulo", capital: "São Paulo", region: "sudeste" },
  { code: "TO", name: "Tocantins", capital: "Palmas", region: "norte" },
];

const BY_CODE = new Map(BRAZIL_STATES.map((state) => [state.code, state]));

export function isStateCode(value: string): value is StateCode {
  return (STATE_CODES as readonly string[]).includes(value);
}

export function stateByCode(code: StateCode): BrazilState {
  const state = BY_CODE.get(code);
  if (!state) throw new Error(`Unknown state code: ${code}`);
  return state;
}

/** Lowercase without accents, so "sao paulo" finds "São Paulo". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
