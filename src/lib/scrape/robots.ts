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
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (key === "disallow" && value === "") continue;
      for (const agent of agents) groups.get(agent)?.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
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

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body.split("*").map(escapeRegex).join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

function escapeRegex(value: string) {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}
