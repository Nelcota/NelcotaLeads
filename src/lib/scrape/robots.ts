type Rule = { allow: boolean; path: string };

/**
 * Minimal robots.txt evaluation: picks the group for our user agent (or `*`)
 * and applies the longest matching Allow/Disallow rule. Supports `*` and `$`.
 */
export function isPathAllowed(robotsTxt: string, userAgent: string, path: string): boolean {
  const groups = new Map<string, Rule[]>();
  let agents: string[] = [];
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!lastWasAgent) agents = [];
      agents.push(value.toLowerCase());
      for (const agent of agents) if (!groups.has(agent)) groups.set(agent, []);
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key !== "allow" && key !== "disallow") continue;
    if (key === "disallow" && value === "") continue;
    for (const agent of agents) groups.get(agent)?.push({ allow: key === "allow", path: value });
  }

  const token = userAgent.toLowerCase().split("/")[0] ?? "";
  const ownGroup = [...groups.entries()].find(([agent]) => agent !== "*" && token.includes(agent));
  const rules = ownGroup?.[1] ?? groups.get("*") ?? [];

  let best: Rule | undefined;
  for (const rule of rules) {
    if (!matches(rule.path, path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best?.allow ?? true;
}

/**
 * Prefix match with `*` wildcards and an optional `$` end anchor, piece by piece with indexOf:
 * the site writes the pattern, and as a `.*` regex a run of wildcards backtracks exponentially.
 */
export function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const [first = "", ...rest] = (anchored ? pattern.slice(0, -1) : pattern).split("*");
  if (!path.startsWith(first)) return false;
  const last = rest.pop();
  if (last === undefined) return !anchored || path.length === first.length;
  let position = first.length;
  // Leftmost match of each middle piece leaves the most room for the ones after it.
  for (const piece of rest) {
    const at = path.indexOf(piece, position);
    if (at === -1) return false;
    position = at + piece.length;
  }
  return anchored
    ? path.length - last.length >= position && path.endsWith(last)
    : path.includes(last, position);
}
