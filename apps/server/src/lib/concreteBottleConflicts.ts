import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import type { AnyTransaction } from "@peated/server/db";
import { bottleAliases, bottles, entities } from "@peated/server/db/schema";
import {
  type ExactBottleAliasBeforeSnapshot,
  ExactBottleAliasConflictError,
  reserveExactBottleAliasWithPreimageInTransaction,
  reserveLiteralCanonicalBottleAliasInTransaction,
} from "@peated/server/lib/bottleAliases";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { and, asc, eq, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export type ConcreteBottleIdentityEntity = {
  name: string;
  shortName?: string | null;
};

export type ConcreteBottleIdentityState = {
  name: string;
  fullName: string;
  brand: ConcreteBottleIdentityEntity;
  bottler: ConcreteBottleIdentityEntity | null;
};

export type ConcreteBottleIdentityCandidate = {
  bottleId: number;
  targetId: number;
  current: ConcreteBottleIdentityState;
  desired: ConcreteBottleIdentityState;
};

export type ConcreteBottleAliasMutation = {
  name: string;
  bottleId: number;
  targetId: number;
  before: ExactBottleAliasBeforeSnapshot | null;
};

export type ConcreteBottleIdentityConflictCause =
  | "full_name"
  | "smws_code"
  | "exact_alias";

export class ConcreteBottleIdentityConflictError extends Error {
  constructor(
    readonly conflictingBottleId: number | null,
    readonly conflictCause: ConcreteBottleIdentityConflictCause,
    options?: ErrorOptions,
  ) {
    super(
      "Concrete Bottle identity conflicts with an existing Bottle.",
      options,
    );
    this.name = "ConcreteBottleIdentityConflictError";
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
  entity: ConcreteBottleIdentityEntity | null,
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

/** Returns the exact SMWS code implied by a concrete Bottle identity. */
export function getSmwsCodeForBottleIdentity({
  name,
  fullName,
  brand,
  bottler,
}: {
  name: string;
  fullName: string;
  brand: ConcreteBottleIdentityEntity;
  bottler: ConcreteBottleIdentityEntity | null;
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
 * until the caller's transaction completes.
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
    brand: ConcreteBottleIdentityEntity;
    bottler: ConcreteBottleIdentityEntity | null;
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

/**
 * Preflights concrete identities and reserves their old/new exact aliases.
 * Callers explicitly choose which current Bottle rows are replaced atomically.
 */
export async function reserveConcreteBottleIdentitiesInTransaction(
  tx: AnyTransaction,
  {
    candidates,
    assignedByActorId,
  }: {
    candidates: ConcreteBottleIdentityCandidate[];
    assignedByActorId: number;
  },
): Promise<{
  changedAliasNames: string[];
  aliasMutations: ConcreteBottleAliasMutation[];
}> {
  const sortedCandidates = [...candidates].sort(
    (left, right) => left.bottleId - right.bottleId,
  );
  const identityChanges = sortedCandidates.filter(
    ({ current, desired }) => current.fullName !== desired.fullName,
  );

  const fullNameOwners = new Map<string, number>();
  for (const candidate of sortedCandidates) {
    const key = candidate.desired.fullName.toLowerCase();
    const owner = fullNameOwners.get(key);
    if (owner !== undefined && owner !== candidate.bottleId) {
      throw new ConcreteBottleIdentityConflictError(owner, "full_name");
    }
    fullNameOwners.set(key, candidate.bottleId);
  }

  if (identityChanges.length) {
    const names = Array.from(
      new Set(
        identityChanges.map(({ desired }) => desired.fullName.toLowerCase()),
      ),
    ).sort();
    const excluded = Array.from(
      new Set(sortedCandidates.map(({ bottleId }) => bottleId)),
    ).sort((left, right) => left - right);
    const [conflictingBottle] = await tx
      .select({ id: bottles.id })
      .from(bottles)
      .where(
        and(
          excluded.length ? notInArray(bottles.id, excluded) : undefined,
          or(...names.map((name) => eq(sql`LOWER(${bottles.fullName})`, name))),
        ),
      )
      .orderBy(asc(bottles.id))
      .limit(1);
    if (conflictingBottle) {
      throw new ConcreteBottleIdentityConflictError(
        conflictingBottle.id,
        "full_name",
      );
    }
  }

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
        throw new ConcreteBottleIdentityConflictError(owner, "smws_code");
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
        throw new ConcreteBottleIdentityConflictError(
          conflictingBottleId,
          "smws_code",
        );
      }
    }
  }

  const reservations = new Map<
    string,
    { name: string; bottleId: number; targetId: number }
  >();
  const literalReservations = new Map<
    string,
    { name: string; bottleId: number; targetId: number }
  >();
  for (const candidate of identityChanges) {
    for (const name of [
      candidate.current.fullName,
      candidate.desired.fullName,
    ]) {
      const key = normalizeBottleAliasKey(name).toLowerCase();
      const existing = reservations.get(key);
      if (existing && existing.bottleId !== candidate.bottleId) {
        throw new ConcreteBottleIdentityConflictError(
          existing.bottleId,
          "exact_alias",
        );
      }
      reservations.set(key, {
        name,
        bottleId: candidate.bottleId,
        targetId: candidate.targetId,
      });
    }

    const literalName = candidate.current.fullName.trim();
    const literalKey = literalName.toLowerCase();
    const existingLiteral = literalReservations.get(literalKey);
    if (existingLiteral && existingLiteral.bottleId !== candidate.bottleId) {
      throw new ConcreteBottleIdentityConflictError(
        existingLiteral.bottleId,
        "exact_alias",
      );
    }
    literalReservations.set(literalKey, {
      name: literalName,
      bottleId: candidate.bottleId,
      targetId: candidate.targetId,
    });
  }

  const changedAliasNames = new Set<string>();
  const aliasMutations = new Map<string, ConcreteBottleAliasMutation>();
  const reserveAlias = async (
    reservation: { name: string; bottleId: number; targetId: number },
    reserve: typeof reserveExactBottleAliasWithPreimageInTransaction,
  ) => {
    try {
      const result = await reserve(tx, {
        name: reservation.name,
        bottleId: reservation.bottleId,
        assignmentSource: "canonical",
        assignedByActorId,
      });
      if (result.changed) {
        changedAliasNames.add(result.name);
        const key = result.name.toLowerCase();
        if (!aliasMutations.has(key)) {
          aliasMutations.set(key, {
            name: result.name,
            bottleId: reservation.bottleId,
            targetId: reservation.targetId,
            before: result.before,
          });
        }
      }
    } catch (error) {
      if (error instanceof ExactBottleAliasConflictError) {
        throw new ConcreteBottleIdentityConflictError(
          error.conflictingBottleId,
          "exact_alias",
          { cause: error },
        );
      }
      throw error;
    }
  };

  for (const reservation of Array.from(reservations.values()).sort(
    (left, right) =>
      normalizeBottleAliasKey(left.name)
        .toLowerCase()
        .localeCompare(normalizeBottleAliasKey(right.name).toLowerCase()),
  )) {
    await reserveAlias(
      reservation,
      reserveExactBottleAliasWithPreimageInTransaction,
    );
  }

  for (const reservation of Array.from(literalReservations.values()).sort(
    (left, right) =>
      left.name.toLowerCase().localeCompare(right.name.toLowerCase()),
  )) {
    await reserveAlias(
      reservation,
      reserveLiteralCanonicalBottleAliasInTransaction,
    );
  }

  return {
    changedAliasNames: Array.from(changedAliasNames).sort(),
    aliasMutations: Array.from(aliasMutations.values()).sort(
      (left, right) =>
        left.name.toLowerCase().localeCompare(right.name.toLowerCase()) ||
        left.name.localeCompare(right.name),
    ),
  };
}
