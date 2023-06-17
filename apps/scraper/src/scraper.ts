import axios from "axios";
import { existsSync, mkdirSync, statSync } from "fs";
import { open } from "fs/promises";

const CACHE = ".cache";

const CACHE_EXPIRE = 60 * 60 * 18 * 1000;

if (!existsSync(CACHE)) {
  mkdirSync(CACHE);
}

export class PageNotFound extends Error {}

export async function getUrl(url: string) {
  const filename = `${CACHE}/${encodeURIComponent(url)}`;

  let data = "",
    status = 0;
  if (!existsSync(filename)) {
    console.log(`${url} not cached, fetching from internet`);
    ({ data, status } = await cacheUrl(url, filename));
  } else if (statSync(filename).mtimeMs < new Date().getTime() - CACHE_EXPIRE) {
    console.log(`${url} cache outdated, fetching from internet`);
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
  const urlParts = new URL(url);

  let data = "";
  let status = 0;
  try {
    ({ status, data } = await axios.get(url, {
      headers: {
        Authority: urlParts.hostname,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7,",
        "Accept-Language": "en-US,en:q=0.9",
        Referer: urlParts.origin,
      },
    }));
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
