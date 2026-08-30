import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { EntityImageDraft } from "@peated/web/components/entityImageEditor.stylex";

type EntityImage = Outputs["entities"]["details"]["images"][number];

type SaveEntityImagesOptions = {
  entityId: number;
  initialImages: readonly EntityImage[];
  images: EntityImageDraft[];
  create: (
    input: Inputs["entities"]["images"]["create"],
  ) => Promise<Outputs["entities"]["images"]["create"]>;
  update: (
    input: Inputs["entities"]["images"]["update"],
  ) => Promise<Outputs["entities"]["images"]["update"]>;
  remove: (
    input: Inputs["entities"]["images"]["delete"],
  ) => Promise<Outputs["entities"]["images"]["delete"]>;
};

function caption(value: string) {
  return value.trim() || null;
}

export async function saveEntityImages({
  entityId,
  initialImages,
  images,
  create,
  update,
  remove,
}: SaveEntityImagesOptions) {
  const initialById = new Map(initialImages.map((image) => [image.id, image]));
  const retainedIds = new Set(
    images
      .map((image) => image.imageId)
      .filter((imageId): imageId is number => imageId !== null),
  );

  const newImages = images
    .filter(
      (image): image is EntityImageDraft & { file: File } =>
        image.file !== null,
    )
    .sort((left, right) => Number(left.isPrimary) - Number(right.isPrimary));
  for (const image of newImages) {
    await create({
      entity: entityId,
      file: image.file,
      caption: caption(image.caption),
      isPrimary: image.isPrimary,
      idempotencyKey: image.key,
    });
  }

  for (const image of images) {
    if (image.imageId === null) continue;
    const initial = initialById.get(image.imageId);
    if (!initial) continue;
    const nextCaption = caption(image.caption);
    const captionChanged = nextCaption !== initial.caption;
    const makePrimary = image.isPrimary && !initial.isPrimary;
    if (!captionChanged && !makePrimary) continue;
    const input: Inputs["entities"]["images"]["update"] = {
      entity: entityId,
      image: image.imageId,
    };
    if (captionChanged) input.caption = nextCaption;
    if (makePrimary) input.makePrimary = true;
    await update(input);
  }

  for (const image of initialImages) {
    if (retainedIds.has(image.id)) continue;
    await remove({ entity: entityId, image: image.id });
  }
}
