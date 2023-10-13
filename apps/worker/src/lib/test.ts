import { readFile } from "fs/promises";
import path from "path";

export async function loadFixture(...paths: string[]) {
  return await readFile(
    path.join(__dirname, "..", "..", "__fixtures__", ...paths),
  );
}
