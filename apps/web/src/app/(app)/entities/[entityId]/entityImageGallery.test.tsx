// @vitest-environment jsdom

import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { EntityImageGallery } from "./entityImageGallery.stylex";
import type { Entity } from "./entityPageData";

const timestamp = "2026-01-01T00:00:00.000Z";

const entity = {
  ...mockEntity,
  images: [
    {
      id: 1,
      entityId: mockEntity.id,
      imageUrl: "https://example.com/primary.jpg",
      caption: "Distillery entrance",
      sourceUrl: "https://example.com/primary-source",
      license: "CC BY 4.0",
      isPrimary: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 2,
      entityId: mockEntity.id,
      imageUrl: "https://example.com/secondary.jpg",
      caption: "Still house",
      sourceUrl: "https://example.com/secondary-source",
      license: null,
      isPrimary: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
} satisfies Entity;

describe("EntityImageGallery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("shows one image and pages through the remaining images", () => {
    act(() => root.render(<EntityImageGallery entity={entity} />));

    const previous = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show previous image"]',
    );
    const next = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show next image"]',
    );

    expect(container.querySelectorAll("figure img")).toHaveLength(1);
    expect(container.querySelector("figure img")?.getAttribute("src")).toBe(
      "https://example.com/primary.jpg",
    );
    expect(container.textContent).toContain("1 / 2");
    expect(container.textContent).toContain("Distillery entrance");
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    act(() => next?.click());

    expect(container.querySelectorAll("figure img")).toHaveLength(1);
    expect(container.querySelector("figure img")?.getAttribute("src")).toBe(
      "https://example.com/secondary.jpg",
    );
    expect(container.textContent).toContain("2 / 2");
    expect(container.textContent).toContain("Still house");
    expect(previous?.disabled).toBe(false);
    expect(next?.disabled).toBe(true);
  });

  test("does not show pagination for one image", () => {
    act(() =>
      root.render(
        <EntityImageGallery
          entity={{ ...entity, images: [entity.images[0]!] }}
        />,
      ),
    );

    expect(container.querySelector('[role="group"]')).toBeNull();
  });
});
