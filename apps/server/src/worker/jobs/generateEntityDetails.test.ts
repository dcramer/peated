import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
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
  expect(pushJob).toHaveBeenCalledWith("GenerateEntityPronunciationAudio", {
    entityId: entity.id,
  });
});

test("keeps generated details when the audio job cannot be queued", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
    description: "A Highland distillery in Oldmeldrum.",
    descriptionSrc: "user",
    yearEstablished: 1797,
    website: "https://www.glengarioch.com",
  });
  const model = vi.fn<EntityDetailsModel>(async () => generatedDetails());
  vi.mocked(pushJob).mockRejectedValueOnce(new Error("Redis is down"));

  await expect(generateEntityDetails(entity.id, model)).resolves.toBe(
    undefined,
  );

  await expect(readEntity(entity.id)).resolves.toMatchObject({
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
      pronunciation: "Glen Geery",
      pronunciationIpa: "/ɡlɛn ˈɡɪəri/",
    }),
  );

  await generateEntityDetails(entity.id, model);

  await expect(readEntity(entity.id)).resolves.toMatchObject({
    pronunciation: null,
    pronunciationIpa: null,
  });
  expect(pushJob).not.toHaveBeenCalled();
});

test("skips the model when the pronunciation is filled", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
    pronunciation: "glen GEER-ee",
    pronunciationIpa: "ɡlɛn ˈɡɪəri",
  });
  const model = vi.fn<EntityDetailsModel>(async () => generatedDetails());

  await generateEntityDetails(entity.id, model);

  expect(model).not.toHaveBeenCalled();
});

test("leaves the description, founding year, and website empty", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    kind: "distillery",
    description: null,
    yearEstablished: null,
    website: null,
  });
  const model = vi.fn<EntityDetailsModel>(async () => generatedDetails());

  await generateEntityDetails(entity.id, model);

  expect(model).toHaveBeenCalledOnce();
  await expect(readEntity(entity.id)).resolves.toMatchObject({
    description: null,
    yearEstablished: null,
    website: null,
    pronunciation: "glen GEER-ee",
  });
});
