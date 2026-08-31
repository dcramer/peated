import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import type { AnyTransaction } from "@peated/server/db";
import { bottleAliases, bottles, entities } from "@peated/server/db/schema";
import {
  ExactBottleAliasConflictError,
  reserveExactBottleAliasInTransaction,
} from "@peated/server/lib/bottleAliases";
import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export type BottleIdentityEntity = {
  name: string;
  shortName?: string | null;
};

export type BottleIdentityState = {
  name: string;
  fullName: string;
  brand: BottleIdentityEntity;
  bottler: BottleIdentityEntity | null;
};

export type BottleIdentityCandidate = {
  bottleId: number;
  current: BottleIdentityState;
  desired: BottleIdentityState;
};

export type BottleIdentityConflictCause = "smws_code";

export class BottleIdentityConflictError extends Error {
  constructor(
    readonly conflictingBottleId: number | null,
    readonly conflictCause: BottleIdentityConflictCause,
    options?: ErrorOptions,
  ) {
    super("Bottle identity conflicts with an existing Bottle.", options);
    this.name = "BottleIdentityConflictError";
  }
}

function getSmwsCodeFromValues(values: Array<string | null | undefined>) {
  for (const value of values) {
    const code = parseSmwsReferenceName(value)?.code;
    if (code) {
      return code;
    }
  }

  return null;
}

function valuesHaveSmwsCode(
  values: Array<string | null | undefined>,
  code: string,
) {
  return values.some((value) => parseSmwsReferenceName(value)?.code === code);
}

function entityNameVariants(
  entity: BottleIdentityEntity | null,
  name: string | null,
) {
  if (!entity || !name) {
    return [];
  }

  return [
    entity.shortName ? `${entity.shortName} ${name}` : null,
    `${entity.name} ${name}`,
  ];
}

/** Returns the exact SMWS code implied by a Bottle identity. */
export function getSmwsCodeForBottleIdentity({
  name,
  fullName,
  brand,
  bottler,
}: {
  name: string;
  fullName: string;
  brand: BottleIdentityEntity;
  bottler: BottleIdentityEntity | null;
}) {
  return getSmwsCodeFromValues([
    fullName,
    ...entityNameVariants(brand, name),
    ...entityNameVariants(bottler, name),
  ]);
}

function rowHasSmwsCode(
  row: {
    aliasName: string | null;
    bottleName: string;
    fullName: string;
    brandName: string | null;
    brandShortName: string | null;
    bottlerName: string | null;
    bottlerShortName: string | null;
  },
  code: string,
) {
  const brand = { name: row.brandName ?? "", shortName: row.brandShortName };
  const bottler = {
    name: row.bottlerName ?? "",
    shortName: row.bottlerShortName,
  };

  return valuesHaveSmwsCode(
    [
      row.aliasName,
      row.fullName,
      ...entityNameVariants(brand, row.bottleName),
      ...entityNameVariants(brand, row.aliasName),
      ...entityNameVariants(bottler, row.bottleName),
      ...entityNameVariants(bottler, row.aliasName),
    ],
    code,
  );
}

/**
 * Finds an equivalent SMWS reference outside the Bottles replaced atomically.
 * The per-code transaction advisory lock serializes create/update decisions
 * until the caller's transaction completes. SMWS subtitles are mutable names:
 * the cask code owns the Bottle, and canonical updates preserve old names as
 * aliases rather than creating another Bottle for a renamed subtitle.
 */
export async function findConflictingSmwsBottleId(
  tx: AnyTransaction,
  {
    name,
    fullName,
    brand,
    bottler,
  }: {
    name: string;
    fullName: string;
    brand: BottleIdentityEntity;
    bottler: BottleIdentityEntity | null;
  },
  { excludeBottleIds = [] }: { excludeBottleIds?: number[] } = {},
): Promise<number | null> {
  const code = getSmwsCodeForBottleIdentity({
    name,
    fullName,
    brand,
    bottler,
  });
  if (!code) {
    return null;
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`smws:${code}`}))`,
  );

  const brandEntity = alias(entities, "smws_conflict_brand");
  const bottlerEntity = alias(entities, "smws_conflict_bottler");
  const codeSearch = `%${code}%`;
  const smwsSearch = "%SMWS%";
  const societySearch = "%Scotch Malt Whisky Society%";

  const rows = await tx
    .select({
      bottleId: bottles.id,
      bottleName: bottles.name,
      fullName: bottles.fullName,
      aliasName: bottleAliases.name,
      brandName: brandEntity.name,
      brandShortName: brandEntity.shortName,
      bottlerName: bottlerEntity.name,
      bottlerShortName: bottlerEntity.shortName,
    })
    .from(bottles)
    .innerJoin(brandEntity, eq(brandEntity.id, bottles.brandId))
    .leftJoin(bottlerEntity, eq(bottlerEntity.id, bottles.bottlerId))
    .leftJoin(
      bottleAliases,
      and(
        eq(bottleAliases.bottleId, bottles.id),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
      ),
    )
    .where(
      and(
        sql`(
          ${bottles.name} ILIKE ${codeSearch}
          OR ${bottles.fullName} ILIKE ${codeSearch}
          OR ${bottleAliases.name} ILIKE ${codeSearch}
        )`,
        sql`(
          LOWER(${brandEntity.name}) IN ('smws', 'the scotch malt whisky society', 'scotch malt whisky society')
          OR LOWER(COALESCE(${brandEntity.shortName}, '')) = 'smws'
          OR LOWER(COALESCE(${bottlerEntity.name}, '')) IN ('smws', 'the scotch malt whisky society', 'scotch malt whisky society')
          OR LOWER(COALESCE(${bottlerEntity.shortName}, '')) = 'smws'
          OR ${bottles.fullName} ILIKE ${smwsSearch}
          OR ${bottles.fullName} ILIKE ${societySearch}
          OR ${bottleAliases.name} ILIKE ${smwsSearch}
          OR ${bottleAliases.name} ILIKE ${societySearch}
        )`,
      ),
    )
    .orderBy(bottles.id);

  const excluded = new Set(excludeBottleIds);
  return (
    rows.find((row) => !excluded.has(row.bottleId) && rowHasSmwsCode(row, code))
      ?.bottleId ?? null
  );
}

/** Preflights SMWS codes and preserves renamed subtitles as exact aliases. */
export async function reserveBottleIdentitiesInTransaction(
  tx: AnyTransaction,
  {
    candidates,
    assignedByActorId,
  }: {
    candidates: BottleIdentityCandidate[];
    assignedByActorId: number;
  },
): Promise<{ changedAliasNames: string[] }> {
  const sortedCandidates = [...candidates].sort(
    (left, right) => left.bottleId - right.bottleId,
  );

  const smwsChanges = sortedCandidates
    .map((candidate) => {
      const currentCode = getSmwsCodeForBottleIdentity(candidate.current);
      const desiredCode = getSmwsCodeForBottleIdentity(candidate.desired);
      return { candidate, currentCode, desiredCode };
    })
    .filter(
      ({ candidate, currentCode, desiredCode }) =>
        candidate.current.fullName !== candidate.desired.fullName ||
        currentCode !== desiredCode,
    );

  if (smwsChanges.length) {
    const smwsCodeOwners = new Map<string, number>();
    for (const candidate of sortedCandidates) {
      const code = getSmwsCodeForBottleIdentity(candidate.desired);
      if (!code) continue;

      const owner = smwsCodeOwners.get(code);
      if (owner !== undefined && owner !== candidate.bottleId) {
        throw new BottleIdentityConflictError(owner, "smws_code");
      }
      smwsCodeOwners.set(code, candidate.bottleId);
    }

    for (const { candidate, desiredCode } of smwsChanges.sort(
      (left, right) =>
        (left.desiredCode ?? "").localeCompare(right.desiredCode ?? "") ||
        left.candidate.bottleId - right.candidate.bottleId,
    )) {
      const conflictingBottleId = await findConflictingSmwsBottleId(
        tx,
        candidate.desired,
        { excludeBottleIds: sortedCandidates.map(({ bottleId }) => bottleId) },
      );
      if (conflictingBottleId !== null) {
        throw new BottleIdentityConflictError(conflictingBottleId, "smws_code");
      }
    }
  }

  const changedAliasNames = new Set<string>();
  for (const { candidate, currentCode, desiredCode } of smwsChanges) {
    if (
      currentCode === null ||
      currentCode !== desiredCode ||
      candidate.current.fullName === candidate.desired.fullName
    ) {
      continue;
    }
    try {
      const result = await reserveExactBottleAliasInTransaction(tx, {
        name: candidate.current.fullName,
        bottleId: candidate.bottleId,
        assignmentSource: "canonical",
        assignedByActorId,
      });
      if (result.changed) changedAliasNames.add(result.name);
    } catch (error) {
      if (error instanceof ExactBottleAliasConflictError) {
        throw new BottleIdentityConflictError(
          error.conflictingBottleId,
          "smws_code",
          { cause: error },
        );
      }
      throw error;
    }
  }

  return { changedAliasNames: Array.from(changedAliasNames).sort() };
}
