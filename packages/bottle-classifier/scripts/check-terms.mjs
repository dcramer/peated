import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));

const roots = [
  "apps/cli/src",
  "apps/server/src",
  "apps/web/src",
  "docs/architecture",
  "docs/features",
  "packages/bottle-classifier/AGENTS.md",
  "packages/bottle-classifier/README.md",
  "packages/bottle-classifier/src",
];

const textExtensions = new Set([
  ".json",
  ".jsonc",
  ".md",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const prohibitedTerms = [
  /\bconcrete[\s-]+bottles?\b/giu,
  /\bparent[\s-]+bottles?\b/giu,
  /\bproposed[\s-]+operations?\b/giu,
  /\bbottle\s+groups?\b/gu,
  /\bBottle\s+groups?\b/gu,
  /\bbottle[\s-]+references?\b/gu,
  /\breview[\s-]+operations?\b/gu,
  /\bsuggested[\s-]+changes?\b/gu,
];

async function* files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".vitest-evals") {
        continue;
      }
      yield* files(entryPath);
    } else if (textExtensions.has(extname(entry.name))) {
      yield entryPath;
    }
  }
}

const violations = [];

for (const root of roots) {
  const path = join(repoRoot, root);
  const paths = extname(path) ? [path] : files(path);
  for await (const file of paths) {
    const content = await readFile(file, "utf8");
    const lines = content.split("\n");
    const fileViolations = new Set();
    for (const term of prohibitedTerms) {
      term.lastIndex = 0;
      for (const match of content.matchAll(term)) {
        const lineNumber = content.slice(0, match.index).split("\n").length;
        fileViolations.add(
          `${relative(repoRoot, file)}:${lineNumber}: ${lines[lineNumber - 1]?.trim()}`,
        );
      }
    }
    violations.push(...fileViolations);
  }
}

if (violations.length > 0) {
  console.error("Use the Bottle classifier glossary terms:\n");
  console.error(violations.join("\n"));
  process.exitCode = 1;
}
