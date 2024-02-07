import { readFile } from "fs/promises";
import path from "path";

export async function loadFixture(...paths: string[]) {
  const data = await readFile(
    path.join(__dirname, "..", "..", "__fixtures__", ...paths),
  );
  return data.toString();
}
