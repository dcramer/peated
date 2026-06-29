import program from "@peated/cli/program";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier";
import { ClassifyBottleReferenceInputSchema } from "@peated/server/agents/bottleClassifier/contract";
import { readFile } from "fs/promises";
import { basename, extname } from "path";

const subcommand = program.command("classifier");

async function readJsonFile(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getImageMimeType(path: string) {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      throw new Error(
        "Unsupported image extension. Use .jpg, .jpeg, .png, .webp, or .gif.",
      );
  }
}

async function getImageReference(image: string) {
  if (isUrl(image)) {
    return image;
  }

  const bytes = await readFile(image);
  return `data:${getImageMimeType(image)};base64,${bytes.toString("base64")}`;
}

async function buildClassifierInput({
  name,
  inputFile,
  image,
  candidateExpansion,
}: {
  name?: string;
  inputFile?: string;
  image?: string;
  candidateExpansion?: "open" | "initial_only";
}) {
  if (inputFile) {
    return ClassifyBottleReferenceInputSchema.parse(
      await readJsonFile(inputFile),
    );
  }

  const imageUrl = image ? await getImageReference(image) : undefined;
  const referenceName =
    name ?? (image ? `Image bottle reference: ${basename(image)}` : null);
  if (!referenceName) {
    throw new Error("Pass a bottle name, --image, or --input-file");
  }

  return ClassifyBottleReferenceInputSchema.parse({
    reference: {
      name: referenceName,
      imageUrl,
    },
    candidateExpansion,
  });
}

subcommand
  .command("run")
  .description("Run the bottle classifier against a bottle name or image")
  .argument("[name]", "bottle reference name")
  .option("--input-file <path>", "JSON ClassifyBottleReferenceInput payload")
  .option("--image <path-or-url>", "local image path or public image URL")
  .option("--initial-only", "disable candidate expansion")
  .action(async (name, options) => {
    const input = await buildClassifierInput({
      name,
      inputFile: options.inputFile,
      image: options.image,
      candidateExpansion: options.initialOnly ? "initial_only" : undefined,
    });
    const result = await classifyBottleReference(input);

    console.log(JSON.stringify(result, null, 2));
  });
