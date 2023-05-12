import axios from "axios";
import { existsSync } from "fs";
import { open } from "fs/promises";

const CACHE = ".cache";

export class PageNotFound extends Error {}

export async function getUrl(url: string) {
  const filename = `${CACHE}/${encodeURIComponent(url)}`;

  let data = "",
    status = 0;
  if (!existsSync(filename)) {
    console.log(`${url} not cached, fetching from internet`);
    ({ data, status } = await cacheUrl(url, filename));
  } else {
    const fs = await open(filename, "r");
    ({ data, status } = JSON.parse((await fs.readFile()).toString()));
    await fs.close();
  }

  if (status === 404) {
    throw new PageNotFound(url);
  }

  return data;
}

export async function cacheUrl(url: string, filename: string) {
  let data = "";
  let status = 0;
  try {
    ({ status, data } = await axios.get(url));
  } catch (err: any) {
    status = err?.response?.status;
    if (status !== 404) {
      throw err;
    }
  }

  const fs = await open(filename, "w");
  await fs.writeFile(
    JSON.stringify({
      status,
      data,
    }),
  );
  await fs.close();

  return { data, status };
}
