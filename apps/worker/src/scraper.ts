import axios from "axios";
import { existsSync, mkdirSync, statSync } from "fs";
import { open } from "fs/promises";
import { defaultHeaders } from "./constants";

const CACHE = ".cache";

const CACHE_EXPIRE = 60 * 60 * 18 * 1000;

if (!existsSync(CACHE)) {
  mkdirSync(CACHE);
}

export class PageNotFound extends Error {}

export async function getUrl(
  url: string,
  noCache = !!process.env.DISABLE_HTTP_CACHE,
) {
  const filename = `${CACHE}/${encodeURIComponent(url)}`;

  let data = "",
    status = 0;
  if (!existsSync(filename) || noCache) {
    console.log(`${url} not cached, fetching from internet`);
    ({ data, status } = await cacheUrl(url, filename));
  } else if (statSync(filename).mtimeMs < new Date().getTime() - CACHE_EXPIRE) {
    console.log(`${url} cache outdated, fetching from internet`);
    ({ data, status } = await cacheUrl(url, filename));
  } else {
    const fs = await open(filename, "r");
    const payload = await fs.readFile();
    ({ data, status } = JSON.parse(payload.toString("utf8")));
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
    ({ status, data } = await axios.get(url, {
      headers: defaultHeaders(url),
    }));
    // gross
    if (typeof data !== "string") data = JSON.stringify(data);
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
      data: data.toString(),
    }),
  );
  await fs.close();

  return { data, status };
}
