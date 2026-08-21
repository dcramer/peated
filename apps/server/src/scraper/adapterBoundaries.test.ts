import { readdir, readFile } from "node:fs/promises";

const scraperUrl = new URL("./", import.meta.url);
const adaptersUrl = new URL("./adapters/", scraperUrl);
const registryUrl = new URL("./registry.ts", scraperUrl);
const forbiddenAdapterImport =
  /from\s+["'](?:axios|got|node-fetch|undici|bullmq|@peated\/server\/db(?:\/|["'])|@peated\/server\/worker\/(?:client|registry)|@peated\/server\/lib\/(?:createBottle|createExternalReview|createStorePrices))/;

async function expectAdapterBoundary(fileUrl: URL, label: string) {
  const source = await readFile(fileUrl, "utf8");
  expect(source, `${label} imports a runtime-owned dependency`).not.toMatch(
    forbiddenAdapterImport,
  );
  expect(source, `${label} calls global fetch directly`).not.toMatch(
    /\bfetch\s*\(/,
  );
}

test("native adapters only use their injected scraper session", async () => {
  const files = (await readdir(adaptersUrl)).filter(
    (name) =>
      name.endsWith(".ts") &&
      !name.endsWith(".test.ts") &&
      !name.startsWith("legacy"),
  );

  for (const file of files) {
    const fileUrl = new URL(file, adaptersUrl);
    await expectAdapterBoundary(fileUrl, file);
    const source = await readFile(fileUrl, "utf8");
    expect(
      source,
      `${file} imports the legacy compatibility bridge`,
    ).not.toMatch(/@peated\/server\/scraper\/legacy\//);
  }
});

test("every registered legacy source stays behind the compatibility bridge", async () => {
  const registry = await readFile(registryUrl, "utf8");
  const registeredSources = [
    ...registry.matchAll(/from\s+["']\.\/adapters\/legacy\/([^"']+)["']/g),
  ].map((match) => match[1]!);

  expect(registeredSources.length).toBeGreaterThan(0);
  for (const sourceName of registeredSources) {
    await expectAdapterBoundary(
      new URL(`./adapters/legacy/${sourceName}.ts`, scraperUrl),
      sourceName,
    );
  }
});

test("core runtime files do not compose production registry or worker infrastructure", async () => {
  const coreFiles = [
    "coordinator.ts",
    "definitions.ts",
    "http.ts",
    "lifecycle.ts",
    "robots.ts",
    "runs.ts",
    "session.ts",
    "syncDefinitions.ts",
    "types.ts",
  ];

  for (const file of coreFiles) {
    const source = await readFile(new URL(file, scraperUrl), "utf8");
    expect(source, `${file} imports production composition`).not.toMatch(
      /from\s+["'](?:\.\/registry|@peated\/server\/worker\/)/,
    );
  }
});

test("the module root does not re-export runtime internals", async () => {
  const source = await readFile(new URL("./index.ts", scraperUrl), "utf8");
  expect(source).not.toMatch(/export\s+(?:\*|\{)[\s\S]*?\sfrom\s+["']\.\//);
});
