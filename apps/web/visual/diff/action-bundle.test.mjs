import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const DIFF_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(DIFF_DIR, "../..");
const REPOSITORY_DIR = path.resolve(WEB_DIR, "../..");
const ACTION_DIR = path.join(
  REPOSITORY_DIR,
  ".github/actions/visual-diff/dist",
);
const NCC = fileURLToPath(import.meta.resolve("@vercel/ncc/dist/ncc/cli.js"));
const tempDirectories = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("visual diff action bundle", () => {
  it("matches the source and includes license notices", async () => {
    const output = await fs.mkdtemp(
      path.join(os.tmpdir(), "visual-diff-action-"),
    );
    tempDirectories.push(output);
    execFileSync(
      process.execPath,
      [
        NCC,
        "build",
        path.join(DIFF_DIR, "action.mjs"),
        "-o",
        output,
        "--minify",
        "--license",
        "THIRD_PARTY_LICENSES.txt",
      ],
      { cwd: WEB_DIR, stdio: "pipe" },
    );

    for (const file of ["index.mjs", "THIRD_PARTY_LICENSES.txt"]) {
      const [actual, expected] = await Promise.all([
        fs.readFile(path.join(ACTION_DIR, file), "utf8"),
        fs.readFile(path.join(output, file), "utf8"),
      ]);
      expect(actual, `${file} is out of date`).toBe(expected);
    }
  });
});
