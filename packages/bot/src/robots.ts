import { z } from "zod";
import { BOT_ROBOTS_PRODUCT } from "./identity";

/** How long a website's robots.txt answer stays valid. */
export const ROBOTS_CACHE_MS = 24 * 60 * 60_000;

/** Robots.txt files larger than this are cut off, as RFC 9309 allows. */
export const ROBOTS_MAX_BYTES = 500 * 1024;

const RobotsRuleSchema = z
  .object({
    directive: z.enum(["allow", "disallow"]),
    path: z.string(),
  })
  .strict();

/**
 * The parsed rules from one website's robots.txt. `missing` means the website
 * publishes no rules. Only the rules are stored, never the file itself.
 */
export const RobotsRulesSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("missing") }).strict(),
  z
    .object({
      status: z.literal("rules"),
      groups: z.array(
        z
          .object({
            userAgents: z.array(z.string()),
            rules: z.array(RobotsRuleSchema),
          })
          .strict(),
      ),
    })
    .strict(),
]);

export type RobotsRules = z.infer<typeof RobotsRulesSchema>;

export function parseRobotsRules(body: string): RobotsRules {
  const groups: Extract<RobotsRules, { status: "rules" }>["groups"] = [];
  let current: (typeof groups)[number] | null = null;

  for (const originalLine of body.split(/\r?\n/)) {
    const line = originalLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!value) continue;
      if (!current || current.rules.length > 0) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      continue;
    }
    if (current && (field === "allow" || field === "disallow") && value) {
      current.rules.push({ directive: field, path: value });
    }
  }

  return { status: "rules", groups };
}

function matchingUserAgentGroups(
  state: Extract<RobotsRules, { status: "rules" }>,
) {
  let specificity = -1;
  const result: typeof state.groups = [];
  for (const group of state.groups) {
    const matchingAgents = group.userAgents.filter(
      (agent) => agent === "*" || BOT_ROBOTS_PRODUCT.startsWith(agent),
    );
    if (matchingAgents.length === 0) continue;
    const groupSpecificity = Math.max(
      ...matchingAgents.map((agent) => (agent === "*" ? 0 : agent.length)),
    );
    if (groupSpecificity > specificity) {
      specificity = groupSpecificity;
      result.length = 0;
    }
    if (groupSpecificity === specificity) result.push(group);
  }
  return result;
}

/**
 * Matches a robots.txt path pattern, where `*` matches any characters and a
 * trailing `$` anchors the end. It uses plain string search instead of a
 * regular expression, so a pattern full of wildcards cannot stall the process.
 */
function robotsPatternMatches(path: string, pattern: string) {
  const endAnchored = pattern.endsWith("$");
  const parts = (endAnchored ? pattern.slice(0, -1) : pattern).split("*");
  const first = parts[0] ?? "";
  if (!path.startsWith(first)) return false;
  if (parts.length === 1) return !endAnchored || path === first;

  let position = first.length;
  for (const part of parts.slice(1, -1)) {
    const index = path.indexOf(part, position);
    if (index < 0) return false;
    position = index + part.length;
  }
  const last = parts.at(-1) ?? "";
  if (!endAnchored) return path.includes(last, position);
  return path.length - last.length >= position && path.endsWith(last);
}

/**
 * Robots rule (RFC 9309): PeatedBot follows the group that names it, or the `*`
 * group when none does, and the longest matching path wins.
 */
export function robotsAllowsUrl(state: RobotsRules, url: URL) {
  if (state.status === "missing") return true;
  const path = `${url.pathname}${url.search}`;
  const matches = matchingUserAgentGroups(state)
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPatternMatches(path, rule.path))
    .map((rule) => ({
      ...rule,
      specificity: rule.path.replace(/[*$]/g, "").length,
    }))
    .sort((left, right) => {
      if (left.specificity !== right.specificity) {
        return right.specificity - left.specificity;
      }
      return left.directive === "allow" ? -1 : 1;
    });
  return matches[0]?.directive !== "disallow";
}
