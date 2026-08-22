import { load as cheerio } from "cheerio";
import { z } from "zod";

const ArticleMetadataSchema = z
  .object({
    type: z.literal("Article"),
    datePublished: z.string().trim().min(1),
    author: z.string().trim().min(1),
  })
  .strict();

type ArticleMetadata = z.infer<typeof ArticleMetadataSchema>;

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads the common article facts that Squarespace publishes as JSON-LD. */
export function parseArticleMetadata(data: string): ArticleMetadata | null {
  const $ = cheerio(data);
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse($(script).text());
    } catch {
      continue;
    }

    const values = Array.isArray(parsed) ? parsed : [parsed];
    for (const value of values) {
      const metadata = objectValue(value);
      const rawAuthor = metadata?.author;
      const author =
        typeof rawAuthor === "string"
          ? rawAuthor
          : objectValue(rawAuthor)?.name;
      const result = ArticleMetadataSchema.safeParse({
        type: metadata?.["@type"],
        datePublished: metadata?.datePublished,
        author,
      });
      if (result.success) return result.data;
    }
  }
  return null;
}
