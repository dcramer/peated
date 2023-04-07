import axios from "axios";
import { load as cheerio } from "cheerio";
import { existsSync } from "fs";
import { open } from "fs/promises";

const MIN_ID = 1;
const MAX_ID = 250000;

const CACHE = ".cache";

async function downloadAndCacheWhisky(id: number, filename: string) {
  const url = `https://www.whiskybase.com/whiskies/whisky/${id}/`;
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
    })
  );
  await fs.close();

  return { data, status };
}

// e.g. https://www.whiskybase.com/whiskies/whisky/1/
async function scrapeWhisky(id: number) {
  console.log(`Processing Whisky ${id}`);

  const filename = `${CACHE}/${id}.html`;
  let data = "",
    status = 0;
  if (!existsSync(filename)) {
    console.log(`[Whisky ${id}] Cache not found, fetching from internet`);
    ({ data, status } = await downloadAndCacheWhisky(id, filename));
  } else {
    const fs = await open(filename, "r");
    ({ data, status } = JSON.parse((await fs.readFile()).toString()));
    await fs.close();
  }

  if (status === 404) {
    console.warn(`[Whisky ${id}] Does not exist`);
    return;
  }

  //   <h1>
  //     <a href="https://www.whiskybase.com/whiskies/brand/81357/balvenie">
  //       <span>Balvenie</span>
  //     </a>
  //     14-year-old Roasted Malt
  //   </h1>;

  const $ = cheerio(data);

  const bottle: any = {};

  const headerEl = $("header > h1").first();

  const brandName = headerEl.find("a").first().text();

  const maybeRegion = $("ul.breadcrumb > li:nth-child(3)").text();
  const region = maybeRegion !== brandName ? maybeRegion : null;

  bottle.brand = {
    name: brandName,
    country: $("ul.breadcrumb > li:nth-child(2)").text(),
    region,
  };
  bottle.name = parseName(brandName, headerEl.get()[0]?.lastChild?.data.trim());

  bottle.category = mapCategory($("dt:contains('Category') + dd").text());

  bottle.distiller = {
    name: $("dt:contains('Distillery') + dd").text(),
    country: bottle.brand.country,
    region,
  };

  // bottle.bottler = {
  //   name: $("dt:contains('Bottler') + dd").text(),
  // };
  bottle.series = $("dt:contains('Bottling serie') + dd").text();

  // bottle.vintageYear = parseYear($("dt:contains('Vintage') + dd").text());
  // bottle.bottleYear = parseYear($("dt:contains('Bottled') + dd").text());

  // bottle.caskType = $("dt:contains('Casktype') + dd").text();
  // bottle.caskNumber = $("dt:contains('Casknumber') + dd").text();

  bottle.abv = parseAbv($("dt:contains('Strength') + dd").text());

  console.log(`[Whisky ${id}] Identified as ${bottle.name} - ${bottle.series}`);

  return bottle;
}

function parseName(brandName: string, bottleName: string) {
  const bottleNameWithoutAge = bottleName.split("-year-old")[0];
  if (bottleNameWithoutAge !== bottleName) {
    bottleName = `${brandName} ${bottleNameWithoutAge}`;
  }
  return bottleName;
}

function parseAbv(value: string) {
  if (!value || value === "") return;
  const amt = value.split(" % ")[0];
  const abv = parseInt(amt * 10, 10) / 100;
  if (!abv) {
    console.warn(`Unable to parse abv: ${value}`);
    return;
  }
  return abv;
}

function parseYear(value: string) {
  if (!value || value === "") return;
  const bits = value.split(".");
  const year = bits[bits.length - 1];
  if (year.length !== 4) {
    console.warn(`Could not parse year: ${value}`);
    return;
  }
  return year;
}

function mapCategory(value: string) {
  switch (value.toLowerCase()) {
    case "blend":
    case "blended malt":
    case "single malt":
    case "spirit":
      return value.toLowerCase().replace(" ", "_");
    default:
      throw new Error(`Unknown category: ${value}`);
  }
}

async function scrape() {
  const maxTasks = 16;

  let numTasks = 0;
  let currentId = MIN_ID;
  while (currentId < MAX_ID) {
    numTasks += 1;
    (async () => {
      const bottle = await scrapeWhisky(currentId);
      await submitBottle(bottle);
      numTasks -= 1;
    })();

    while (numTasks >= maxTasks - 1) {
      await sleep(100);
    }
    currentId += 1;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const API_SERVER = process.env.API_SERVER || "http://localhost:4000";

async function submitBottle(bottle: any) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TOKEN}`,
  };

  try {
    const resp = await axios.post(`${API_SERVER}/bottles`, bottle, {
      headers,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    console.error(`Failed to submit bottle: ${JSON.stringify(data, null, 2)}`);
  }
}

scrape();
