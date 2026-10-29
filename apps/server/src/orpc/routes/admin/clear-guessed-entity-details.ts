import { db } from "@peated/server/db";
import { changes, entities, type Change } from "@peated/server/db/schema";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import { getPublishedFoundingYear } from "@peated/server/lib/entityAbout/publicAbout";
import {
  getEntityAbout,
  loadLinkedEntities,
} from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, asc, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import { z } from "zod";

// Every field a version of the old GenerateEntityDetails job wrote. A change
// with any other field came from a person or another job.
const OLD_JOB_FIELDS = new Set([
  "address",
  "country",
  "description",
  "descriptionSrc",
  "pronunciation",
  "pronunciationIpa",
  "region",
  "type",
  "website",
  "yearEstablished",
]);

const FIELDS = ["yearEstablished", "website"] as const;
type Field = (typeof FIELDS)[number];

type Guess = {
  entityId: number;
  name: string;
  field: Field;
  value: string | number;
  newValue: number | null;
  changeId: number;
  guessedAt: string;
};

/**
 * The fields whose stored value the old job guessed. Guess rule (owner:
 * docs/features/entity-about.md): a value is a guess only when the last
 * change to set it was one of the job's updates and it still holds that
 * value. A later change by anyone, including an About page, keeps it.
 */
function findGuesses(
  entity: Pick<
    typeof entities.$inferSelect,
    "id" | "name" | "yearEstablished" | "website"
  >,
  history: Change[],
  peatedActorId: number,
  citedYear: number | null,
): Guess[] {
  return FIELDS.flatMap((field) => {
    const value = entity[field];
    if (value === null) return [];
    const last = history.findLast((change) => field in change.data);
    if (
      !last ||
      last.actorId !== peatedActorId ||
      last.type !== "update" ||
      !Object.keys(last.data).every((key) => OLD_JOB_FIELDS.has(key)) ||
      last.data[field] !== value
    ) {
      return [];
    }
    const newValue = field === "yearEstablished" ? citedYear : null;
    // The About page cites the same year, so it is no longer a guess.
    if (newValue === value) return [];
    return [
      {
        entityId: entity.id,
        name: entity.name,
        field,
        value,
        newValue,
        changeId: last.id,
        guessedAt: last.createdAt.toISOString(),
      },
    ];
  });
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/clear-guessed-entity-details",
    summary: "Clear guessed Entity founding years and websites",
    description:
      "Clear founding years and websites that the old Entity details job guessed from a model's memory. A guessed founding year becomes the year the published About page cites, when it cites one. Values a person or another job set later are kept. Use `dryRun` to list what would change without changing anything. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
    operationId: "clearGuessedEntityDetails",
  })
  .input(
    z
      .object({
        afterId: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Check Entities with IDs greater than this value"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(100)
          .describe("Number of Entities to check"),
        dryRun: z
          .boolean()
          .default(false)
          .describe("List the values that would change, but change none"),
      })
      .strict(),
  )
  .output(
    z.object({
      guesses: z
        .array(
          z.object({
            entityId: z.number(),
            name: z.string(),
            field: z.enum(FIELDS),
            value: z.union([z.string(), z.number()]),
            newValue: z
              .number()
              .nullable()
              .describe("The cited About year, or null when cleared"),
            changeId: z.number().describe("The job change that set it"),
            guessedAt: z.string(),
          }),
        )
        .describe("Values changed, or that would change in a dry run"),
      checked: z.number(),
      nextAfterId: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await db
      .select({
        id: entities.id,
        name: entities.name,
        yearEstablished: entities.yearEstablished,
        website: entities.website,
      })
      .from(entities)
      .where(
        and(
          gt(entities.id, input.afterId),
          or(isNotNull(entities.yearEstablished), isNotNull(entities.website)),
        ),
      )
      .orderBy(asc(entities.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    const nextAfterId = rows.length > input.limit ? page.at(-1)!.id : null;

    const history = page.length
      ? await db
          .select()
          .from(changes)
          .where(
            and(
              eq(changes.objectType, "entity"),
              inArray(
                changes.objectId,
                page.map(({ id }) => id),
              ),
            ),
          )
          .orderBy(asc(changes.id))
      : [];
    const peatedActor = await getPeatedSystemActorForDatabase(db);

    const guesses: Guess[] = [];
    for (const entity of page) {
      const entityHistory = history.filter(
        ({ objectId }) => objectId === entity.id,
      );
      let found = findGuesses(entity, entityHistory, peatedActor.id, null);
      // Only a guessed year needs the About page, so most Entities skip it.
      if (found.some(({ field }) => field === "yearEstablished")) {
        const about = await getEntityAbout(db, entity.id);
        const citedYear = about
          ? getPublishedFoundingYear(
              about,
              await loadLinkedEntities(db, [about.document]),
            )
          : null;
        found = findGuesses(entity, entityHistory, peatedActor.id, citedYear);
      }
      if (!found.length) continue;
      if (input.dryRun) {
        guesses.push(...found);
        continue;
      }

      const saved = await db.transaction(async (tx) => {
        const [current] = await tx
          .select({
            yearEstablished: entities.yearEstablished,
            website: entities.website,
          })
          .from(entities)
          .where(eq(entities.id, entity.id))
          .for("no key update");
        // An edit since the page read wins; the next run sees it.
        if (
          !current ||
          found.some(({ field, value }) => current[field] !== value)
        ) {
          return false;
        }
        const patch = Object.fromEntries(
          found.map(({ field, newValue }) => [field, newValue]),
        );
        const before = Object.fromEntries(
          found.map(({ field, value }) => [field, value]),
        );
        await tx
          .update(entities)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(entities.id, entity.id));
        await tx.insert(changes).values({
          objectType: "entity",
          objectId: entity.id,
          displayName: entity.name,
          actorId: peatedActor.id,
          type: "update",
          data: { ...patch, before },
        });
        return true;
      });
      if (saved) guesses.push(...found);
    }

    return { guesses, checked: page.length, nextAfterId };
  });
