import { readdir, readFile } from "node:fs/promises";

const adaptersUrl = new URL("./adapters/", import.meta.url);
const forbiddenImport =
  /from\s+["'](?:axios|got|node-fetch|undici|bullmq|@peated\/server\/db(?:\/|["'])|@peated\/server\/worker\/(?:client|registry)|@peated\/server\/lib\/(?:createBottle|createExternalReview|createStorePrices))/;

test("scraper adapters cannot bypass runtime-owned boundaries", async () => {
  const files = (await readdir(adaptersUrl)).filter((name) =>
    name.endsWith(".ts"),
  );

  for (const file of files) {
    const source = await readFile(new URL(file, adaptersUrl), "utf8");
    expect(source, `${file} imports a runtime-owned dependency`).not.toMatch(
      forbiddenImport,
    );
    expect(source, `${file} calls global fetch directly`).not.toMatch(
      /\bfetch\s*\(/,
    );
  }
});
