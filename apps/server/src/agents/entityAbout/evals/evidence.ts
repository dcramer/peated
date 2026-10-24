import { normalizeSourceUrl } from "@peated/server/lib/entityAbout/document";
import { readdirSync, readFileSync } from "node:fs";
import { z } from "zod";

import type { AboutWebSource } from "../webTools";

// Each case is a reviewed evidence pack: Peated's stored fields for one
// Entity and the pages the writer may read. Search returns every saved page;
// a page outside the pack cannot be read. Sources and review notes are in
// each file. Rules: docs/development/model-checks.md.
export const EvidenceSchema = z.object({
  case: z.string(),
  reviewedAt: z.string(),
  entity: z.object({
    name: z.string(),
    kind: z.enum(["distillery", "brand"]),
    aliases: z.array(z.string()),
    location: z.string().nullable(),
    owner: z.string().nullable(),
    yearEstablished: z.number().nullable(),
    website: z.string().nullable(),
  }),
  pages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        publisher: z.string(),
        description: z.string(),
        text: z.string(),
      }),
    )
    .min(1),
  expected: z.object({
    events: z.array(
      z.object({ kind: z.string(), year: z.string().regex(/^\d{4}$/) }),
    ),
    thin: z.boolean().optional(),
    notes: z.string(),
  }),
  notes: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

const EVIDENCE_DIR = new URL("./", import.meta.url);
export const ABOUT_EVAL_CASES = readdirSync(EVIDENCE_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) =>
    EvidenceSchema.parse(
      JSON.parse(readFileSync(new URL(file, EVIDENCE_DIR), "utf8")),
    ),
  );

export function savedSource(pages: Evidence["pages"]): AboutWebSource {
  return {
    search: async () =>
      pages.map(({ url, title, description }) => ({ url, title, description })),
    read: async (url) => {
      const page = pages.find(
        (saved) => normalizeSourceUrl(saved.url) === normalizeSourceUrl(url),
      );
      if (!page) throw new Error("This page could not be read.");
      return { title: page.title, text: page.text };
    },
  };
}
