import type { Place, PlacesProvider } from "./types";

const PREFIXES = ["Clínica", "Studio", "Centro", "Espaço", "Instituto", "Casa", "Ateliê", "Grupo"];
const SUFFIXES = ["Vida", "Sorriso", "Bem-Estar", "Central", "Prime", "Saúde", "Mais", "Essencial"];

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pad(n: number, size: number) {
  return String(n % 10 ** size).padStart(size, "0");
}

/** Deterministic fake data so the app runs without a Google key. Same query → same place ids. */
export function createMockPlacesProvider(): PlacesProvider {
  return {
    name: "mock",
    async search({ niche, city, maxResults }) {
      const places: Place[] = Array.from({ length: Math.min(maxResults, 60) }, (_, i) => {
        const name = `${PREFIXES[i % PREFIXES.length]} ${SUFFIXES[(i * 3) % SUFFIXES.length]} ${i + 1}`;
        // Mix of profiles: no site, unreachable site and a real reachable site.
        const website =
          i % 3 === 0
            ? null
            : i % 3 === 1
              ? `https://${slug(name)}.invalid`
              : "https://example.com";
        return {
          placeId: `mock:${slug(niche)}:${slug(city)}:${i + 1}`,
          name: `${name} (${niche})`,
          address: `Rua Exemplo, ${100 + i} - ${city}`,
          phone: i % 5 === 4 ? null : `(31) 98${pad(i * 37, 3)}-${pad(1000 + i * 97, 4)}`,
          website,
          rating: i % 4 === 0 ? 3.6 : 4.2 + (i % 8) / 10,
          reviewCount: (i * 37) % 250,
          mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(name)}`,
          businessStatus: "OPERATIONAL",
        };
      });
      return { places, requests: 0 };
    },
  };
}
