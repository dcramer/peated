import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { selectBaseline } from "./select-baseline.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const CAPTURE = {
  browserVersion: "Chromium 140",
  contract: 1,
  platform: "linux-x64",
  runner: "ubuntu24",
};
const roots = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "peated-baseline-"));
  roots.push(root);
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  const candidate = path.join(root, "candidate.json");
  await fs.mkdir(source);
  await Promise.all([
    fs.writeFile(path.join(source, "home__desktop.png"), "home"),
    fs.writeFile(path.join(source, "search__desktop.png"), "search"),
    fs.writeFile(
      path.join(source, "manifest.json"),
      JSON.stringify({
        capture: CAPTURE,
        changedFiles: [],
        commitSha: SHA,
        scenarioIds: ["home", "search"],
        screenshots: [
          { file: "home__desktop.png", label: "Home · Desktop" },
          { file: "search__desktop.png", label: "Search · Desktop" },
        ],
      }),
    ),
    fs.writeFile(
      candidate,
      JSON.stringify({
        capture: CAPTURE,
        changedFiles: ["apps/web/src/app/page.tsx"],
        commitSha: "ffffffffffffffffffffffffffffffffffffffff",
        scenarioIds: ["home", "new-page"],
        screenshots: [
          { file: "home__desktop.png", label: "Home · Desktop" },
          { file: "new-page__desktop.png", label: "New page · Desktop" },
        ],
      }),
    ),
  ]);
  return { candidate, output, root, source };
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { force: true, recursive: true })),
  );
});

describe("baseline selection", () => {
  test("copies only baseline images requested by the candidate", async () => {
    const paths = await fixture();
    await selectBaseline({ ...paths, sha: SHA });

    await expect(
      fs.readFile(path.join(paths.output, "home__desktop.png"), "utf8"),
    ).resolves.toBe("home");
    await expect(
      fs.stat(path.join(paths.output, "search__desktop.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    const manifest = JSON.parse(
      await fs.readFile(path.join(paths.output, "manifest.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      changedFiles: ["apps/web/src/app/page.tsx"],
      commitSha: SHA,
      scenarioIds: ["home", "new-page"],
      screenshots: [{ file: "home__desktop.png" }],
      selection: "artifact",
    });
  });

  test("rejects a baseline from another revision", async () => {
    const paths = await fixture();
    await expect(
      selectBaseline({
        ...paths,
        sha: "ffffffffffffffffffffffffffffffffffffffff",
      }),
    ).rejects.toThrow("Baseline manifest is for");
  });

  test("rejects an incompatible capture environment", async () => {
    const paths = await fixture();
    const candidate = JSON.parse(await fs.readFile(paths.candidate, "utf8"));
    candidate.capture.browserVersion = "Chromium 141";
    await fs.writeFile(paths.candidate, JSON.stringify(candidate));

    await expect(selectBaseline({ ...paths, sha: SHA })).rejects.toThrow(
      "capture environments differ",
    );
  });
});
