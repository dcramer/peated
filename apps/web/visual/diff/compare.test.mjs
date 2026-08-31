import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "vitest";

import { compareDirectories } from "./compare.mjs";

const tempDirectories = [];

async function makeDirectories() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "visual-diff-"));
  tempDirectories.push(root);
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  const output = path.join(root, "output");
  await Promise.all([
    fs.mkdir(baseline, { recursive: true }),
    fs.mkdir(candidate, { recursive: true }),
  ]);
  return { baseline, candidate, output };
}

async function writePng(
  file,
  { color = [255, 255, 255, 255], height = 2, width = 2 } = {},
) {
  const image = new PNG({ height, width });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data.set(color, index);
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, PNG.sync.write(image));
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("compareDirectories", () => {
  it("keeps the output separate from input images", async () => {
    const paths = await makeDirectories();

    await expect(
      compareDirectories({ ...paths, output: paths.baseline }),
    ).rejects.toThrow("Output directory must be separate");
  });

  it("does not write an image for matching pixels", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "home.png")),
      writePng(path.join(paths.candidate, "home.png")),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary).toEqual({
      added: 0,
      changed: 0,
      removed: 0,
      unchanged: 1,
    });
    expect(report.files).toEqual([{ file: "home.png", status: "unchanged" }]);
    await expect(
      fs.stat(path.join(paths.output, "images/home.png")),
    ).rejects.toThrow();
  });

  it("writes a diff for changed pixels", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "home.png")),
      writePng(path.join(paths.candidate, "home.png"), {
        color: [0, 0, 0, 255],
      }),
    ]);

    const report = await compareDirectories(paths);
    const diff = PNG.sync.read(
      await fs.readFile(path.join(paths.output, "images/home.png")),
    );

    expect(report.summary.changed).toBe(1);
    expect(report.files[0]).toMatchObject({
      file: "home.png",
      image: "images/home.png",
      status: "changed",
    });
    expect([...diff.data.subarray(0, 4)]).toEqual([255, 0, 255, 255]);
  });

  it("writes a diff for resized images", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "nested/home.png")),
      writePng(path.join(paths.candidate, "nested/home.png"), { width: 3 }),
    ]);

    const report = await compareDirectories(paths);
    const diff = PNG.sync.read(
      await fs.readFile(path.join(paths.output, "images/nested/home.png")),
    );

    expect(report.summary.changed).toBe(1);
    expect(report.files[0]).toMatchObject({
      file: "nested/home.png",
      height: 2,
      image: "images/nested/home.png",
      status: "changed",
      width: 3,
    });
    expect({ height: diff.height, width: diff.width }).toEqual({
      height: 2,
      width: 3,
    });
    expect([...diff.data.subarray(8, 12)]).toEqual([255, 0, 255, 255]);
  });

  it("copies added and removed images into the report", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "removed.png")),
      writePng(path.join(paths.candidate, "added.png")),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary).toEqual({
      added: 1,
      changed: 0,
      removed: 1,
      unchanged: 0,
    });
    expect(report.files).toEqual([
      { file: "added.png", image: "images/added.png", status: "added" },
      { file: "removed.png", image: "images/removed.png", status: "removed" },
    ]);
    await expect(
      fs.stat(path.join(paths.output, "images/added.png")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(paths.output, "images/removed.png")),
    ).resolves.toBeDefined();
  });
});
