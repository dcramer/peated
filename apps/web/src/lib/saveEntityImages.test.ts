import type { Outputs } from "@peated/server/orpc/router";
import { describe, expect, test, vi } from "vitest";

import type { EntityImageDraft } from "@peated/web/components/entityImageEditor.stylex";

import { saveEntityImages } from "./saveEntityImages";

type EntityImage = Outputs["entities"]["details"]["images"][number];

function storedImage(overrides: Partial<EntityImage> = {}): EntityImage {
  return {
    id: 1,
    entityId: 10,
    imageUrl: "https://api.example/uploads/entities/one.webp",
    caption: "Old caption",
    isPrimary: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function draft(overrides: Partial<EntityImageDraft> = {}): EntityImageDraft {
  return {
    key: "image-1",
    imageId: 1,
    file: null,
    imageUrl: "https://api.example/uploads/entities/one.webp",
    caption: "Old caption",
    isPrimary: true,
    ...overrides,
  };
}

describe("saveEntityImages", () => {
  test("creates new images with the selected primary image last", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const fileOne = new File(["one"], "one.jpg", { type: "image/jpeg" });
    const fileTwo = new File(["two"], "two.jpg", { type: "image/jpeg" });

    await saveEntityImages({
      entityId: 10,
      initialImages: [],
      images: [
        draft({
          key: "new-primary",
          imageId: null,
          file: fileOne,
          caption: " Primary ",
          isPrimary: true,
        }),
        draft({
          key: "new-secondary",
          imageId: null,
          file: fileTwo,
          caption: "",
          isPrimary: false,
        }),
      ],
      create,
      update: vi.fn(),
      remove: vi.fn(),
    });

    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ file: fileTwo, isPrimary: false }),
    );
    expect(create).toHaveBeenNthCalledWith(2, {
      entity: 10,
      file: fileOne,
      caption: "Primary",
      isPrimary: true,
      idempotencyKey: "new-primary",
    });
  });

  test("updates changed metadata and removes missing images", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const first = storedImage();
    const second = storedImage({ id: 2, isPrimary: false, caption: null });

    await saveEntityImages({
      entityId: 10,
      initialImages: [first, second],
      images: [
        draft({
          key: "image-2",
          imageId: 2,
          caption: "Front gate",
          isPrimary: true,
        }),
      ],
      create: vi.fn(),
      update,
      remove,
    });

    expect(update).toHaveBeenCalledWith({
      entity: 10,
      image: 2,
      caption: "Front gate",
      makePrimary: true,
    });
    expect(remove).toHaveBeenCalledWith({ entity: 10, image: 1 });
  });
});
