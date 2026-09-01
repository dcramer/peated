import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const screenshotFileSchema = z
  .string()
  .refine(
    (value) =>
      value.endsWith(".png") &&
      !value.startsWith("/") &&
      !value.includes("\\") &&
      value.split("/").every((part) => part && part !== "." && part !== ".."),
    "Screenshot paths must be safe relative PNG paths",
  );

const manifestSchema = z
  .object({
    capture: z.object({
      browserVersion: z.string().nullable(),
      contract: z.literal(1),
      platform: z.string(),
      runner: z.string(),
    }),
    changedFiles: z.array(z.string()),
    commitSha: z
      .string()
      .regex(/^[0-9a-f]{40}$/i)
      .nullable(),
    scenarioIds: z.array(z.string()),
    screenshots: z.array(
      z
        .object({
          file: screenshotFileSchema,
          label: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--") continue;
    if (!["--candidate", "--output", "--sha", "--source"].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    values[flag.slice(2)] = value;
  }
  for (const name of ["candidate", "output", "sha", "source"]) {
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
  const seen = new Set();
  for (const screenshot of manifest.screenshots) {
    const fileName = screenshot.file;
    if (seen.has(fileName))
      throw new Error(`Duplicate screenshot: ${fileName}`);
    seen.add(fileName);
  }
  return manifest;
}

export async function selectBaseline({ candidate, output, sha, source }) {
  const [baselineManifest, candidateManifest] = await Promise.all([
    readManifest(path.join(source, "manifest.json")),
    readManifest(candidate),
  ]);
  if (baselineManifest.commitSha?.toLowerCase() !== sha.toLowerCase()) {
    throw new Error(
      `Baseline manifest is for ${baselineManifest.commitSha ?? "an unknown revision"}, not ${sha}`,
    );
  }
  if (
    candidateManifest.screenshots.length > 0 &&
    JSON.stringify(baselineManifest.capture) !==
      JSON.stringify(candidateManifest.capture)
  ) {
    throw new Error(
      "Baseline and candidate capture environments differ; generate a compatible baseline instead of comparing pixels",
    );
  }

  const baselineByFile = new Map(
    baselineManifest.screenshots.map((screenshot) => [
      screenshot.file,
      screenshot,
    ]),
  );
  const selected = [];
  await fs.rm(output, { force: true, recursive: true });
  await fs.mkdir(output, { recursive: true });
  for (const screenshot of candidateManifest.screenshots) {
    const file = screenshot.file;
    const baselineScreenshot = baselineByFile.get(file);
    if (!baselineScreenshot) continue;
    const destination = path.join(output, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(source, file), destination);
    selected.push(baselineScreenshot);
  }

  await fs.writeFile(
    path.join(output, "manifest.json"),
    `${JSON.stringify(
      {
        ...baselineManifest,
        changedFiles: candidateManifest.changedFiles,
        scenarioIds: candidateManifest.scenarioIds,
        screenshots: selected,
        selection: "artifact",
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  selectBaseline(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
