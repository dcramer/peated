import type { CheerioAPI } from "cheerio";

/** Converts the selected review body to plain text with paragraph breaks. */
export function readReviewBody(content: ReturnType<CheerioAPI>): string {
  const excluded =
    "script, style, noscript, nav, aside, footer, form, button, iframe, svg, .comments, #comments";
  const body = content.not(excluded).clone();
  body.find(excluded).remove();
  // Review scrapers use HTML blocks for paragraphs, not line breaks in the source.
  body
    .find("*")
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type === "text") node.data = node.data.replaceAll(/\s+/gu, " ");
    });
  body.find("br").replaceWith("\n");
  body
    .find(
      "p, div, section, article, h1, h2, h3, h4, h5, h6, li, blockquote, tr",
    )
    .before("\n\n")
    .after("\n\n");
  body.append("\n\n");
  return body
    .text()
    .split(/\n+/u)
    .map((line) => line.replaceAll(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
