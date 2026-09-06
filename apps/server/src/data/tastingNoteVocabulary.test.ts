import { TAG_CATEGORIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { inArray, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  TASTING_NOTE_AMBIGUOUS_MAPPINGS,
  TASTING_NOTE_EXCLUSION_RULES,
  TASTING_NOTE_SOURCE_URLS,
  TASTING_NOTE_SYNONYM_ADDITIONS,
  TASTING_NOTE_VOCABULARY_ADDITIONS,
} from "./tastingNoteVocabulary";

const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();

describe("tasting note vocabulary", () => {
  test("provides a substantial source-backed completion", () => {
    expect(TASTING_NOTE_VOCABULARY_ADDITIONS.length).toBeGreaterThan(150);
    expect(TASTING_NOTE_SYNONYM_ADDITIONS.length).toBeGreaterThan(35);
    expect(TASTING_NOTE_EXCLUSION_RULES.length).toBeGreaterThan(0);

    const usedSources = new Set(
      [
        ...TASTING_NOTE_VOCABULARY_ADDITIONS,
        ...TASTING_NOTE_SYNONYM_ADDITIONS,
      ].flatMap(({ sources }) => sources),
    );
    expect(usedSources).toEqual(new Set(Object.keys(TASTING_NOTE_SOURCE_URLS)));
  });

  test("maps every canonical descriptor to one existing wheel category", () => {
    const categoryCounts = Object.fromEntries(
      TAG_CATEGORIES.map((category) => [category, 0]),
    );
    for (const entry of TASTING_NOTE_VOCABULARY_ADDITIONS) {
      categoryCounts[entry.tagCategory] += 1;
    }

    expect(categoryCounts).toMatchInlineSnapshot(`
      {
        "cereal": 10,
        "earthy": 38,
        "floral": 23,
        "fruit": 18,
        "smoke": 14,
        "spice": 7,
        "sulfur": 9,
        "sweet": 14,
        "wood": 20,
      }
    `);
  });

  test("keeps names and synonyms normalized, unique, and within storage limits", () => {
    const canonicalNames = new Set<string>();
    const vocabularyTerms = new Map<string, string>();

    for (const entry of TASTING_NOTE_VOCABULARY_ADDITIONS) {
      expect(entry.name).toBe(normalize(entry.name));
      expect(entry.name.length).toBeLessThanOrEqual(64);
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(canonicalNames.has(entry.name)).toBe(false);
      canonicalNames.add(entry.name);

      for (const term of [entry.name, ...entry.synonyms]) {
        expect(term).toBe(normalize(term));
        expect(term.length).toBeGreaterThan(0);
        expect(term.length).toBeLessThanOrEqual(64);
        expect(vocabularyTerms.get(term)).toBeUndefined();
        vocabularyTerms.set(term, entry.name);
      }
    }

    const synonymTargets = new Set<string>();
    for (const addition of TASTING_NOTE_SYNONYM_ADDITIONS) {
      expect(addition.name).toBe(normalize(addition.name));
      expect(addition.name.length).toBeLessThanOrEqual(64);
      expect(addition.sources.length).toBeGreaterThan(0);
      expect(canonicalNames.has(addition.name)).toBe(false);
      expect(synonymTargets.has(addition.name)).toBe(false);
      synonymTargets.add(addition.name);

      for (const synonym of addition.synonyms) {
        expect(synonym).toBe(normalize(synonym));
        expect(synonym.length).toBeGreaterThan(0);
        expect(synonym.length).toBeLessThanOrEqual(64);
        expect(canonicalNames.has(synonym)).toBe(false);
        expect(vocabularyTerms.get(synonym)).toBeUndefined();
        vocabularyTerms.set(synonym, addition.name);
      }
    }
  });

  test("installs every reviewed name, synonym, and wheel mapping", async () => {
    const expected = [
      ...TASTING_NOTE_VOCABULARY_ADDITIONS,
      ...TASTING_NOTE_SYNONYM_ADDITIONS,
    ];
    const migration = await readFile(
      new URL(
        "../../migrations/0273_complete-tasting-note-vocabulary.sql",
        import.meta.url,
      ),
      "utf8",
    );

    await db.transaction(async (tx) => {
      await tx.insert(tags).values({
        name: "ash",
        synonyms: ["ashy"],
        tagCategory: "smoke",
      });
      await tx.execute(sql.raw(migration));
      const installed = await tx
        .select({
          name: tags.name,
          synonyms: tags.synonyms,
          tagCategory: tags.tagCategory,
        })
        .from(tags)
        .where(
          inArray(
            tags.name,
            expected.map(({ name }) => name),
          ),
        );
      const installedByName = new Map(installed.map((tag) => [tag.name, tag]));

      expect(installed).toHaveLength(expected.length);
      for (const entry of expected) {
        const tag = installedByName.get(entry.name);
        expect(tag?.tagCategory, entry.name).toBe(entry.tagCategory);
        expect(tag?.synonyms, entry.name).toEqual(
          expect.arrayContaining([...entry.synonyms]),
        );
      }
      expect(installedByName.get("ash")?.synonyms).toContain("ashy");
    });
  });

  test("refuses to give an existing synonym to a different tag", async () => {
    const migration = await readFile(
      new URL(
        "../../migrations/0273_complete-tasting-note-vocabulary.sql",
        import.meta.url,
      ),
      "utf8",
    );

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(tags).values({
          name: "collision owner",
          synonyms: ["wood varnish"],
          tagCategory: "wood",
        });
        await tx.execute(sql.raw(migration));
      }),
    ).rejects.toThrow("found a synonym owned by another tag");
  });

  test("documents every exceptional category decision", () => {
    const additionsByName = new Map(
      TASTING_NOTE_VOCABULARY_ADDITIONS.map((entry) => [entry.name, entry]),
    );

    for (const decision of TASTING_NOTE_AMBIGUOUS_MAPPINGS) {
      expect(decision.reason).not.toBe("");
      expect(additionsByName.get(decision.name)?.tagCategory).toBe(
        decision.tagCategory,
      );
    }
  });
});
