import { db } from "@peated/server/db";
import {
  reviewAboutDraft,
  type AboutPageRead,
} from "@peated/server/lib/entityAbout/checks";
import { isFactShown } from "@peated/server/lib/entityAbout/display";
import { normalizeSourceUrl } from "@peated/server/lib/entityAbout/document";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import * as fixtures from "@peated/server/lib/test/fixtures";
import type { AboutCitation } from "@peated/server/schemas/entityAbout";
import { writeEntityAbout } from "@peated/server/worker/jobs/writeEntityAbout";
import { onTestFailed } from "vitest";

import { draftToDocument } from "./draftSchema";
import { ABOUT_EVAL_CASES, savedSource, type Evidence } from "./evals/evidence";
import {
  createEntityAboutWriter,
  type EntityAboutWriterResult,
} from "./writer";

async function createEntity({ entity }: Evidence) {
  const [region, country] = entity.location?.includes(", ")
    ? entity.location.split(", ")
    : [null, entity.location];
  const countryId = country
    ? (await fixtures.Country({ name: country })).id
    : null;
  const regionId =
    region && countryId
      ? (await fixtures.Region({ name: region, countryId })).id
      : null;
  const ownerId = entity.owner
    ? (await fixtures.Entity({ name: entity.owner, kind: "company" })).id
    : null;
  const created = await fixtures.Entity({
    name: entity.name,
    kind: entity.kind,
    countryId,
    regionId,
    ownerId,
    yearEstablished: entity.yearEstablished,
    website: entity.website,
  });
  for (const name of entity.aliases) {
    await fixtures.EntityAlias({ entityId: created.id, name });
  }
  return created;
}

// Each fact of a draft with its citations, marking the ones the checks kept,
// so a failed case shows which quotes were dropped and why a fact is hidden.
// Like the job, it counts the pages read on every try so far.
function describeDraft(
  { draft }: EntityAboutWriterResult,
  pagesRead: AboutPageRead[],
  kind: Evidence["entity"]["kind"],
) {
  const { document, errors: conversionErrors } = draftToDocument(draft);
  const {
    document: reviewed,
    errors,
    dropped,
  } = reviewAboutDraft(document, pagesRead, kind, null);
  const keptSiteFacts = new Map(Object.entries(reviewed.siteFacts));
  const citationKey = ({ sourceId, quote }: AboutCitation) =>
    `${sourceId}\n${quote}`;
  const keptQuotes = (citations: AboutCitation[] = []) =>
    new Set(citations.map(citationKey));
  const listCitations = (
    citations: AboutCitation[],
    kept: ReadonlySet<string>,
  ) =>
    citations.map((citation) => ({
      sourceId: citation.sourceId,
      statedValue: citation.statedValue,
      quote: citation.quote,
      kept: kept.has(citationKey(citation)),
    }));
  return {
    pagesRead: pagesRead.map((page) => page.url),
    // Items the output format rejected never reach the document below.
    conversionErrors,
    // Why the job retried or rejected this draft, before any trim, and
    // why the checks dropped each fact.
    errors,
    dropped,
    // A fact the checks drop as a whole (an unquoted year, name, or number)
    // shows kept: false; its citations then show which quotes still passed.
    events: document.events.map((event) => {
      const kept = reviewed.events.find((e) => e.id === event.id);
      return {
        id: event.id,
        kind: event.kind,
        date: event.date,
        text: event.text,
        kept: Boolean(kept),
        citations: listCitations(event.citations, keptQuotes(kept?.citations)),
      };
    }),
    siteFacts: Object.entries(document.siteFacts).map(([field, fact]) => {
      const kept = keptSiteFacts.get(field);
      return {
        field,
        value: fact.value,
        kept: Boolean(kept),
        citations: listCitations(fact.citations, keptQuotes(kept?.citations)),
      };
    }),
    sentences: document.sections.flatMap((section) =>
      section.sentences.map((sentence) => ({
        section: section.key,
        text: sentence.text,
        factIds: sentence.factIds,
      })),
    ),
  };
}

// Runs the real job with a writer that reads only a case's saved pages. The
// cases and their review notes are in ./evals/.
describe.skipIf(!isAIGatewayConfigured())("About writer", () => {
  test.each(
    ABOUT_EVAL_CASES.map((evidence) => [evidence.case, evidence] as const),
  )(
    "%s",
    async (_name, evidence) => {
      const entity = await createEntity(evidence);
      const write = createEntityAboutWriter(() => savedSource(evidence.pages));
      const runs: EntityAboutWriterResult[] = [];

      let result: Awaited<ReturnType<typeof writeEntityAbout>> | undefined;
      // Registered first so a writer error on the retry still prints the drafts.
      onTestFailed(() => {
        console.info(
          `About writer case ${evidence.case}: ${JSON.stringify({
            result,
            runs: runs.map((run, index) =>
              describeDraft(
                run,
                runs.slice(0, index + 1).flatMap((r) => r.pagesRead),
                evidence.entity.kind,
              ),
            ),
          })}`,
        );
      });

      result = await writeEntityAbout(
        { entityId: entity.id },
        {
          enabled: true,
          writer: async (input) => {
            const run = await write(input);
            runs.push(run);
            return run;
          },
          now: () => new Date(),
        },
      );

      // The job's own checks decide whether a draft is saved; a rejected run
      // lists every reason.
      expect(result, JSON.stringify(result)).toMatchObject({ status: "saved" });
      const document = (await getEntityAbout(db, entity.id))!.document;
      const shownEvents = document.events.filter((event) =>
        isFactShown(event.citations, document.sources),
      );
      for (const { kind, year } of evidence.expected.events) {
        const kinds = [kind].flat();
        expect(
          shownEvents.some(
            (event) =>
              kinds.includes(event.kind) && event.date.startsWith(year),
          ),
          `${kinds.join(" or ")} in ${year}`,
        ).toBe(true);
      }
      // Every source the page shows is one of the saved pages.
      const savedUrls = new Set(
        evidence.pages.map((page) => normalizeSourceUrl(page.url)),
      );
      for (const source of document.sources) {
        expect(savedUrls.has(normalizeSourceUrl(source.url))).toBe(true);
      }
      // With little evidence the page stays short: a lead and no sections.
      if (evidence.expected.thin) {
        expect(
          document.sections.filter((section) => section.key !== "lead"),
        ).toEqual([]);
      }
      // A run may use its whole web budget and a retry: often over 5 minutes.
    },
    900_000,
  );
});
