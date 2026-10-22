import { describe, expect, test } from "vitest";

import { screenshotFile, storiesFromIndex } from "./storybook-screenshots.mjs";

describe("storiesFromIndex", () => {
  test("returns only stories in stable order", () => {
    expect(
      storiesFromIndex({
        entries: {
          docs: { id: "components-button--docs", type: "docs" },
          saving: {
            id: "components-workflow--saving",
            name: "Saving",
            title: "Components/Layout/Workflow Screen",
            type: "story",
          },
          overview: {
            id: "components-button--overview",
            name: "Overview",
            title: "Components/Buttons & Menus/Button",
            type: "story",
          },
        },
      }),
    ).toEqual([
      {
        id: "components-button--overview",
        name: "Overview",
        title: "Components/Buttons & Menus/Button",
        type: "story",
      },
      {
        id: "components-workflow--saving",
        name: "Saving",
        title: "Components/Layout/Workflow Screen",
        type: "story",
      },
    ]);
  });
});

describe("screenshotFile", () => {
  test("uses the story as a Frameshift variant", () => {
    expect(
      screenshotFile({
        id: "components-workflow--saving",
        name: "Saving",
        title: "Components/Layout/Workflow Screen",
        type: "story",
      }),
    ).toBe("storybook/components/layout/workflow-screen__saving.png");
  });
});
