/**
 * SSRF guard for outbound fetches of third-party websites. Checks the URL itself
 * (scheme, port, credentials, host); DNS-level protection comes from the Workers
 * `global_fetch_strictly_public` compatibility flag.
 *
 * `new URL` already normalizes decimal, hex, octal and short IPv4 forms
 * ("2130706433", "0x7f.1", "127.1") to dotted quads and compresses IPv6, so the
 * checks below only need to handle the canonical forms.
 */

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".localdomain"];

/** Returns why the URL must not be fetched, or null when it is a public http(s) URL. */
export function unsafeUrlReason(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Protocolo não permitido";
  if (url.username || url.password) return "URL com credenciais não é permitida";
  if (url.port && url.port !== "80" && url.port !== "443") return "Porta não permitida";

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "Endereço não permitido";

  if (host.startsWith("[")) {
    const groups = parseIpv6(host.slice(1, -1));
    return !groups || isBlockedIpv6(groups) ? "Endereço não permitido" : null;
  }
  const ipv4 = parseIpv4(host);
  if (ipv4) return isBlockedIpv4(ipv4) ? "Endereço não permitido" : null;

  if (host === "localhost" || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "Endereço não permitido";
  }
  // Single-label names only resolve inside private networks.
  if (!host.includes(".")) return "Endereço não permitido";
  return null;
}

function parseIpv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function isBlockedIpv4([a = 0, b = 0, c = 0]: number[]): boolean {
  return (
    a === 0 || // "this network", includes 0.0.0.0
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF protocol assignments, TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Expands an IPv6 literal (without brackets) to eight 16-bit groups. */
function parseIpv6(literal: string): number[] | null {
  let text = literal.split("%")[0] ?? "";
  // Trailing dotted IPv4 ("::ffff:1.2.3.4"); `new URL` normally rewrites it already.
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (dotted?.[1]) {
    const v4 = parseIpv4(dotted[1]);
    if (!v4) return null;
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    text = `${text.slice(0, -dotted[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function embeddedIpv4(high: number, low: number): number[] {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isBlockedIpv6(groups: number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // ::/96 covers unspecified (::), loopback (::1) and deprecated IPv4-compatible addresses.
  if (firstFiveZero && g5 === 0) return true;
  // IPv4-mapped ::ffff:0:0/96.
  if (firstFiveZero && g5 === 0xffff) return isBlockedIpv4(embeddedIpv4(g6, g7));
  // NAT64 64:ff9b::/96.
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  // 6to4 2002::/16 embeds an IPv4 address in groups 1-2.
  if (g0 === 0x2002) return isBlockedIpv4(embeddedIpv4(g1, g2));
  return (
    (g0 & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (g0 & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (g0 & 0xffc0) === 0xfec0 || // deprecated site-local fec0::/10
    (g0 & 0xff00) === 0xff00 || // multicast
    (g0 === 0x2001 && g1 === 0) || // Teredo
    (g0 === 0x2001 && g1 === 0xdb8) // documentation
  );
}
