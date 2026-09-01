import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { validateBaseline } from "./validate-baseline.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const CAPTURE = {
  browserVersion: "Chromium 140",
  contract: 2,
  platform: "linux-x64",
  runner: "ubuntu24",
};
const roots = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "peated-baseline-"));
  roots.push(root);
  const baseline = path.join(root, "baseline.json");
  const candidate = path.join(root, "candidate.json");
  await Promise.all([
    writeManifest(baseline, {
      capture: CAPTURE,
      commitSha: SHA,
      screenshots: [{ file: "routes/home.png", label: "Home" }],
    }),
    writeManifest(candidate, {
      capture: CAPTURE,
      commitSha: "ffffffffffffffffffffffffffffffffffffffff",
      screenshots: [{ file: "routes/home.png", label: "Home" }],
    }),
  ]);
  return { baseline, candidate };
}

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { force: true, recursive: true })),
  );
});

describe("baseline validation", () => {
  test("accepts the exact revision and capture environment", async () => {
    const paths = await fixture();

    await expect(
      validateBaseline({ ...paths, sha: SHA }),
    ).resolves.toBeUndefined();
  });

  test("accepts the retired runner contract during baseline migration", async () => {
    const paths = await fixture();
    const baseline = JSON.parse(await fs.readFile(paths.baseline, "utf8"));
    baseline.capture.contract = 1;
    await writeManifest(paths.baseline, baseline);

    await expect(
      validateBaseline({ ...paths, sha: SHA }),
    ).resolves.toBeUndefined();
  });

  test("rejects a baseline from another revision", async () => {
    const paths = await fixture();

    await expect(
      validateBaseline({
        ...paths,
        sha: "ffffffffffffffffffffffffffffffffffffffff",
      }),
    ).rejects.toThrow("Baseline manifest is for");
  });

  test("rejects an incompatible capture environment", async () => {
    const paths = await fixture();
    const candidate = JSON.parse(await fs.readFile(paths.candidate, "utf8"));
    candidate.capture.browserVersion = "Chromium 141";
    await writeManifest(paths.candidate, candidate);

    await expect(validateBaseline({ ...paths, sha: SHA })).rejects.toThrow(
      "capture environments differ",
    );
  });

  test("rejects unsafe and duplicate snapshot paths", async () => {
    const paths = await fixture();
    const candidate = JSON.parse(await fs.readFile(paths.candidate, "utf8"));
    candidate.screenshots = [
      { file: "../home.png", label: "Home" },
      { file: "../home.png", label: "Home again" },
    ];
    await writeManifest(paths.candidate, candidate);

    await expect(validateBaseline({ ...paths, sha: SHA })).rejects.toThrow();
  });
});

async function writeManifest(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value)}\n`);
}
