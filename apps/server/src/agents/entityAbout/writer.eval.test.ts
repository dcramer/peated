import { db } from "@peated/server/db";
import { isFactShown } from "@peated/server/lib/entityAbout/display";
import { normalizeSourceUrl } from "@peated/server/lib/entityAbout/document";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import * as fixtures from "@peated/server/lib/test/fixtures";
import { writeEntityAbout } from "@peated/server/worker/jobs/writeEntityAbout";

import { ABOUT_EVAL_CASES, savedSource, type Evidence } from "./evals/evidence";
import { createEntityAboutWriter } from "./writer";

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

// Runs the real job with a writer that reads only a case's saved pages. The
// cases and their review notes are in ./evals/.
describe.skipIf(!isAIGatewayConfigured())("About writer", () => {
  test.each(
    ABOUT_EVAL_CASES.map((evidence) => [evidence.case, evidence] as const),
  )("%s", async (_name, evidence) => {
    const entity = await createEntity(evidence);

    const result = await writeEntityAbout(
      { entityId: entity.id },
      {
        enabled: true,
        writer: createEntityAboutWriter(() => savedSource(evidence.pages)),
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
      expect(
        shownEvents.some(
          (event) => event.kind === kind && event.date.startsWith(year),
        ),
        `${kind} in ${year}`,
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
  });
});
