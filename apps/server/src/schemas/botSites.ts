import { z } from "zod";

/**
 * A website PeatedBot reads, named by its origin. Any address on the website
 * is accepted and reduced to its origin, such as `https://example.com`.
 */
export const BotSiteOriginSchema = z
  .url({
    protocol: /^https?$/,
    error: "Enter a web address, such as https://example.com.",
  })
  .trim()
  .transform((value) => new URL(value).origin);

export const BotSiteSchema = z.object({
  origin: z.string().url(),
  /** When a direct read first hit a bot wall; reads use Firecrawl until cleared. */
  blockedAt: z.string().datetime().nullable(),
  robotsException: z
    .object({
      reason: z.string(),
      createdAt: z.string().datetime(),
      createdBy: z.object({ id: z.number(), username: z.string() }).nullable(),
    })
    .nullable(),
});

export const BotSiteUpdateSchema = z
  .object({
    origin: BotSiteOriginSchema,
    /** Set or replace the robots.txt exception, or remove it with null. */
    robotsException: z
      .object({ reason: z.string().trim().min(1).max(500) })
      .strict()
      .nullable()
      .optional(),
    /** Clears the blocked mark, so the next read goes direct again. */
    blocked: z.literal(false).optional(),
  })
  .strict()
  .refine(
    (value) => value.robotsException !== undefined || value.blocked === false,
    { message: "Nothing to change." },
  );
