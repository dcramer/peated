import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  BottleContextSourceSchema,
  type BottleContextSeriesRef,
} from "./bottleContextContract";
import type { BottleCandidate, EntityResolution } from "./classifierTypes";
import {
  auditBottleEvalFixtureSchema,
  listFixtureFiles,
  normalizeAuditFixtureSeriesName,
  type AuditBottleEvalFixture,
} from "./evalFixtureSchemas";

const fixtureDir = fileURLToPath(
  new URL("./eval-fixtures/audit-cases/", import.meta.url),
);

function fixtureEntityRef(
  name: string,
  inspectedEntities: EntityResolution[],
  fallbackId: number,
) {
  const inspected = inspectedEntities.find(
    (entity) => entity.name.toLowerCase() === name.toLowerCase(),
  );
  return {
    entityId: inspected?.entityId ?? fallbackId,
    name: inspected?.name ?? name,
  };
}

function fixtureSeriesRef(
  candidate: BottleCandidate,
  inspectedSeries: BottleContextSeriesRef[],
) {
  const seriesName = candidate.series;
  if (seriesName === null) {
    return null;
  }

  const series = inspectedSeries.find(
    ({ name }) =>
      normalizeAuditFixtureSeriesName(name) ===
      normalizeAuditFixtureSeriesName(seriesName),
  );
  if (!series) {
    throw new Error(
      `Audit fixture Bottle ${candidate.bottleId} references undeclared Series ${seriesName}`,
    );
  }
  return series;
}

export function buildAuditEvalBottleContext(
  candidate: BottleCandidate,
  inspectedEntities: EntityResolution[],
  inspectedSeries: BottleContextSeriesRef[],
) {
  if (candidate.brand === null) {
    throw new Error(
      `Audit fixture Bottle ${candidate.bottleId} must include a brand`,
    );
  }

  const fallbackBase = 1_000_000_000 + candidate.bottleId * 10;
  return BottleContextSourceSchema.parse({
    bottleId: candidate.bottleId,
    fullName: candidate.fullName,
    groupId: candidate.bottleId,
    shared: {
      name: candidate.fullName,
      statedAge: candidate.statedAge,
      series: fixtureSeriesRef(candidate, inspectedSeries),
      category: candidate.category,
      brand: fixtureEntityRef(
        candidate.brand,
        inspectedEntities,
        fallbackBase + 1,
      ),
      distillers: candidate.distillery.map((name, index) =>
        fixtureEntityRef(name, inspectedEntities, fallbackBase + 2 + index),
      ),
      bottler:
        candidate.bottler === null
          ? null
          : fixtureEntityRef(
              candidate.bottler,
              inspectedEntities,
              fallbackBase + 8,
            ),
    },
    exact: {
      edition: candidate.edition,
      statedAge: null,
      abv: candidate.abv,
      singleCask: candidate.singleCask,
      caskStrength: candidate.caskStrength,
      vintageYear: candidate.vintageYear,
      releaseYear: candidate.releaseYear,
      caskSize: candidate.caskSize,
      caskType: candidate.caskType,
      caskFill: candidate.caskFill,
    },
    siblings: [],
    aliases: candidate.alias ? [{ name: candidate.alias, ignored: false }] : [],
    observations: [],
    imageSources: [],
  });
}

export function getAuditEvalBottleContexts(fixture: AuditBottleEvalFixture) {
  if (fixture.input.context.bottleContexts !== undefined) {
    return fixture.input.context.bottleContexts;
  }

  return [
    fixture.input.context.currentBottle,
    ...fixture.input.context.inspectedBottles,
  ].map((candidate) =>
    buildAuditEvalBottleContext(
      candidate,
      fixture.input.context.inspectedEntities,
      fixture.input.context.inspectedSeries,
    ),
  );
}

function loadAuditBottleEvalFixtures(): AuditBottleEvalFixture[] {
  return listFixtureFiles(fixtureDir).map((filename) =>
    auditBottleEvalFixtureSchema.parse(
      JSON.parse(readFileSync(filename, "utf8")),
    ),
  );
}

export const AUDIT_BOTTLE_EVAL_CASES = loadAuditBottleEvalFixtures();
