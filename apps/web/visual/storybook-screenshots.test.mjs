import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  replaceStorybookScreenshotsInManifest,
  screenshotFile,
  storiesFromIndex,
} from "./storybook-screenshots.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

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

describe("replaceStorybookScreenshotsInManifest", () => {
  test("replaces Storybook screenshots and preserves route screenshots", async () => {
    const output = await temporaryDirectory();
    await fs.writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify({
        capture: { browserVersion: "1" },
        screenshots: [
          { file: "routes/home.png", label: "Home" },
          {
            file: "storybook/components/old-story.png",
            label: "Old story",
          },
        ],
      }),
    );
    const storyFile = "storybook/components/button__overview.png";
    await fs.mkdir(path.join(output, "storybook/components"), {
      recursive: true,
    });
    await fs.writeFile(path.join(output, storyFile), "screenshot");

    await replaceStorybookScreenshotsInManifest({
      browserVersion: "1",
      output,
      screenshots: [{ file: storyFile, label: "Button / Overview" }],
    });

    const manifest = JSON.parse(
      await fs.readFile(path.join(output, "manifest.json"), "utf8"),
    );
    expect(manifest.screenshots).toEqual([
      { file: "routes/home.png", label: "Home" },
      { file: storyFile, label: "Button / Overview" },
    ]);
  });

  test("rejects a different browser version", async () => {
    const output = await temporaryDirectory();
    await fs.writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify({
        capture: { browserVersion: "1" },
        screenshots: [{ file: "routes/home.png", label: "Home" }],
      }),
    );

    await expect(
      replaceStorybookScreenshotsInManifest({
        browserVersion: "2",
        output,
        screenshots: [],
      }),
    ).rejects.toThrow(
      "Storybook and E2E screenshots must use the same browser version.",
    );
  });

  test("uses the Storybook browser version when there are no route screenshots", async () => {
    const output = await temporaryDirectory();
    await fs.writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify({
        capture: { browserVersion: null },
        screenshots: [],
      }),
    );

    await replaceStorybookScreenshotsInManifest({
      browserVersion: "1",
      output,
      screenshots: [],
    });

    const manifest = JSON.parse(
      await fs.readFile(path.join(output, "manifest.json"), "utf8"),
    );
    expect(manifest.capture.browserVersion).toBe("1");
  });
});

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "peated-storybook-screenshots-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
