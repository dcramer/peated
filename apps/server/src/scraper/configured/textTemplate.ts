import { z } from "zod";

const TOKEN = /\{(?:anything|line|value)\}/gu;

export const ScrapeTextTemplateSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .superRefine((template, context) => {
    const tokens: string[] = template.match(TOKEN) ?? [];
    const remaining = template.replaceAll(TOKEN, "");
    if (/[{}]/u.test(remaining)) {
      context.addIssue({
        code: "custom",
        message: "Text matches may use only {anything}, {line}, and {value}.",
      });
    }
    if (tokens.filter((token) => token === "{value}").length > 1) {
      context.addIssue({
        code: "custom",
        message: "Text matches may contain {value} only once.",
      });
    }
    if (tokens.length > 5) {
      context.addIssue({
        code: "custom",
        message: "Text matches may contain at most five placeholders.",
      });
    }
    if (!remaining.trim() && !tokens.includes("{line}")) {
      context.addIssue({
        code: "custom",
        message: "Text matches must contain fixed text or {line}.",
      });
    }
  });

export const ScrapeTextMatchesSchema = z
  .array(ScrapeTextTemplateSchema)
  .min(1)
  .max(3);

function escapePattern(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Returns the selected value from a bounded text template. */
export function matchText(text: string, template: string) {
  const normalizedText = text
    .split("\n")
    .map((line) => line.replaceAll(/\s+/gu, " ").trim())
    .join("\n")
    .replaceAll(/\n+/gu, "\n")
    .trim();
  const normalizedTemplate = ScrapeTextTemplateSchema.parse(
    template,
  ).replaceAll(/\s+/gu, " ");
  let pattern = "^";
  let offset = 0;
  for (const match of normalizedTemplate.matchAll(TOKEN)) {
    pattern += escapePattern(normalizedTemplate.slice(offset, match.index));
    if (match[0] === "{value}") pattern += "(?<value>[\\s\\S]+?)";
    else if (match[0] === "{line}") pattern += "\\n";
    else pattern += "(?:[\\s\\S]*?)";
    offset = match.index + match[0].length;
  }
  pattern += escapePattern(normalizedTemplate.slice(offset));
  pattern += "$";
  const result = new RegExp(pattern, "iu").exec(normalizedText);
  if (!result) return null;
  return (
    (result.groups?.value ?? normalizedText).replaceAll(/\s+/gu, " ").trim() ||
    null
  );
}

export function matchFirstText(text: string, templates: string[] | null) {
  if (!templates) return text.replaceAll(/\s+/gu, " ").trim() || null;
  for (const template of templates) {
    const value = matchText(text, template);
    if (value) return value;
  }
  return null;
}
