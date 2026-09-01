import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const screenshotSchema = z.object({
  file: z
    .string()
    .refine(
      (value) =>
        value.endsWith(".png") &&
        !value.startsWith("/") &&
        !value.includes("\\") &&
        value.split("/").every((part) => part && part !== "." && part !== ".."),
      "Snapshot paths must be safe relative PNG paths",
    ),
  label: z.string(),
});

const captureSchema = z.object({
  browserVersion: z.string().nullable(),
  contract: z.union([z.literal(1), z.literal(2)]),
  platform: z.string(),
  runner: z.string(),
});

const manifestSchema = z.object({
  capture: captureSchema,
  commitSha: z
    .string()
    .regex(/^[0-9a-f]{40}$/i)
    .nullable(),
  screenshots: z.array(screenshotSchema.passthrough()),
});

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--") continue;
    if (!["--baseline", "--candidate", "--sha"].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    values[flag.slice(2)] = value;
  }
  for (const name of ["baseline", "candidate", "sha"]) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  if (!/^[0-9a-f]{40}$/i.test(values.sha)) {
    throw new Error("--sha must be a full commit SHA");
  }
  return values;
}

async function readManifest(file) {
  const manifest = manifestSchema.parse(
    JSON.parse(await fs.readFile(file, "utf8")),
  );
  const files = manifest.screenshots.map(({ file: screenshot }) => screenshot);
  if (new Set(files).size !== files.length) {
    throw new Error(`Duplicate snapshots in ${file}`);
  }
  return manifest;
}

export async function validateBaseline({ baseline, candidate, sha }) {
  const [baselineManifest, candidateManifest] = await Promise.all([
    readManifest(baseline),
    readManifest(candidate),
  ]);
  if (baselineManifest.commitSha?.toLowerCase() !== sha.toLowerCase()) {
    throw new Error(
      `Baseline manifest is for ${baselineManifest.commitSha ?? "an unknown revision"}, not ${sha}`,
    );
  }
  if (
    candidateManifest.screenshots.length > 0 &&
    JSON.stringify(normalizeLegacyCapture(baselineManifest.capture)) !==
      JSON.stringify(candidateManifest.capture)
  ) {
    throw new Error(
      "Baseline and candidate capture environments differ; generate a compatible baseline instead of comparing pixels",
    );
  }
}

function normalizeLegacyCapture(capture) {
  // Contract 1 is the one-time bridge from the retired scenario runner. The
  // browser settings are compatible, and new main artifacts use contract 2.
  return capture.contract === 1 ? { ...capture, contract: 2 } : capture;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  validateBaseline(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
