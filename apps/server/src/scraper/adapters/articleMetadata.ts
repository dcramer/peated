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
const JsonLdObjectSchema = z.record(z.string(), z.json());

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
      const metadataResult = JsonLdObjectSchema.safeParse(value);
      if (!metadataResult.success) continue;
      const metadata = metadataResult.data;
      const authorResult = z
        .union([z.string(), z.object({ name: z.string() })])
        .safeParse(metadata.author);
      const authorText = authorResult.success
        ? z.string().safeParse(authorResult.data)
        : null;
      const author = authorText?.success
        ? authorText.data
        : authorResult.success
          ? z.object({ name: z.string() }).parse(authorResult.data).name
          : undefined;
      const result = ArticleMetadataSchema.safeParse({
        type: metadata["@type"],
        datePublished: metadata.datePublished,
        author,
      });
      if (result.success) return result.data;
    }
  }
  return null;
}
