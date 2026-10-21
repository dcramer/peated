import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import {
  type EntityDetailsModel,
  type GeneratedEntityDetails,
  generateEntityDetails as generateEntityDetailsWithServices,
  getGeneratedEntityDetails,
} from "./generateEntityDetails";

function generatedDetails(
  details: Partial<GeneratedEntityDetails> = {},
): GeneratedEntityDetails {
  return {
    description: null,
    yearEstablished: null,
    website: null,
    kind: "distillery",
    pronunciation: "glen GEER-ee",
    pronunciationIpa: "ɡlɛn ˈɡɪəri",
    ...details,
  };
}

function generateEntityDetails(
  entityId: number,
  model: ReturnType<typeof vi.fn<EntityDetailsModel>>,
) {
  return generateEntityDetailsWithServices(
    { entityId },
    {
      aiEnabled: true,
      generateDetails: async (entity) =>
        await getGeneratedEntityDetails(entity, model),
    },
  );
}

async function readEntity(entityId: number) {
  return await db.query.entities.findFirst({
    where: eq(entities.id, entityId),
  });
}

test("fills a missing pronunciation", async ({ fixtures }) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
    description: "A Highland distillery in Oldmeldrum.",
    descriptionSrc: "user",
    yearEstablished: 1797,
    website: "https://www.glengarioch.com",
  });
  const model = vi.fn<EntityDetailsModel>(async () => generatedDetails());

  await generateEntityDetails(entity.id, model);

  expect(model).toHaveBeenCalledOnce();
  expect(model.mock.calls[0][1]).toContain("'pronunciation'");
  await expect(readEntity(entity.id)).resolves.toMatchObject({
    pronunciation: "glen GEER-ee",
    pronunciationIpa: "ɡlɛn ˈɡɪəri",
  });
});

test("keeps an existing pronunciation", async ({ fixtures }) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
    pronunciation: "glen GEER-ee",
  });
  const model = vi.fn<EntityDetailsModel>(async () =>
    generatedDetails({
      pronunciation: "glen GAIR-ee-ock",
      pronunciationIpa: "ɡlɛn ˈɡɪəri",
    }),
  );

  await generateEntityDetails(entity.id, model);

  await expect(readEntity(entity.id)).resolves.toMatchObject({
    pronunciation: "glen GEER-ee",
    pronunciationIpa: "ɡlɛn ˈɡɪəri",
  });
});

test("drops a generated pronunciation in the wrong format", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
  });
  const model = vi.fn<EntityDetailsModel>(async () =>
    generatedDetails({
      description: "A Highland distillery in Oldmeldrum.",
      pronunciation: "Glen Geery",
      pronunciationIpa: "/ɡlɛn ˈɡɪəri/",
    }),
  );

  await generateEntityDetails(entity.id, model);

  await expect(readEntity(entity.id)).resolves.toMatchObject({
    description: "A Highland distillery in Oldmeldrum.",
    pronunciation: null,
    pronunciationIpa: null,
  });
});

test("skips the model when every generated field is filled", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
    description: "A Highland distillery in Oldmeldrum.",
    descriptionSrc: "user",
    yearEstablished: 1797,
    website: "https://www.glengarioch.com",
    pronunciation: "glen GEER-ee",
    pronunciationIpa: "ɡlɛn ˈɡɪəri",
  });
  const model = vi.fn<EntityDetailsModel>(async () => generatedDetails());

  await generateEntityDetails(entity.id, model);

  expect(model).not.toHaveBeenCalled();
});
