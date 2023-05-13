import { open } from "fs/promises";
import { submitEntity } from "./api";

const importJson = async (
  filename: string,
  cb: (row: any) => Promise<void>,
) => {
  const fs = await open(filename, "r");
  const rows = JSON.parse((await fs.readFile()).toString());
  await fs.close();

  for (const r of rows) {
    cb(r);
  }
};

const importBrands = async () => {
  await importJson("brands.json", async (row) => {
    await submitEntity({ ...row, type: ["brand"] });
  });
};

const importDistillers = async () => {
  await importJson("distillers.json", async (row) => {
    await submitEntity({ ...row, type: ["distiller"] });
  });
};

async function main() {
  await importBrands();
  await importDistillers();
}

main();
