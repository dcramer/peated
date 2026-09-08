import { generateKeyPairSync } from "node:crypto";
import { chmod, mkdir, realpath, stat, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(scriptDirectory, "../../..");
const filename = "peated-bot-private.jwk";
const encodedKeyPattern = /^[A-Za-z0-9_-]{43}$/;

function isWithin(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${sep}`) &&
      isAbsolute(pathFromParent) === false)
  );
}

async function resolveThroughExistingAncestor(path) {
  const missingSegments = [];
  let existingPath = path;

  while (true) {
    try {
      await stat(existingPath);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }

      const parent = dirname(existingPath);
      if (parent === existingPath) {
        throw error;
      }
      missingSegments.unshift(basename(existingPath));
      existingPath = parent;
    }
  }

  return resolve(await realpath(existingPath), ...missingSegments);
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_[0] === "--") {
    arguments_.shift();
  }
  const [outputArgument] = arguments_;
  if (!outputArgument || arguments_.length !== 1) {
    throw new Error(
      "Usage: pnpm --filter @peated/server generate:peated-bot-key -- /absolute/private/directory",
    );
  }
  if (!isAbsolute(outputArgument)) {
    throw new Error("The output directory must be an absolute path.");
  }

  const outputDirectory = resolve(outputArgument);
  if (outputDirectory === parse(outputDirectory).root) {
    throw new Error("The output directory must be a dedicated subdirectory.");
  }

  const actualRepositoryDirectory = await realpath(repositoryDirectory);
  const prospectiveOutputDirectory =
    await resolveThroughExistingAncestor(outputDirectory);
  if (isWithin(actualRepositoryDirectory, prospectiveOutputDirectory)) {
    throw new Error("Refusing to create a private key inside the repository.");
  }

  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const actualOutputDirectory = await realpath(outputDirectory);
  if (isWithin(actualRepositoryDirectory, actualOutputDirectory)) {
    throw new Error("Refusing to create a private key inside the repository.");
  }
  await chmod(actualOutputDirectory, 0o700);

  const outputPath = resolve(actualOutputDirectory, filename);
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });

  if (
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    !encodedKeyPattern.test(jwk.x ?? "") ||
    !encodedKeyPattern.test(jwk.d ?? "")
  ) {
    throw new Error("Node.js did not generate a valid Ed25519 private key.");
  }

  try {
    await writeFile(outputPath, `${JSON.stringify(jwk)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `Refusing to overwrite the existing key at ${outputPath}.`,
        { cause: error },
      );
    }
    throw error;
  }
  await chmod(outputPath, 0o600);

  console.log(`Created ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
