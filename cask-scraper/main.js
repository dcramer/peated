const cheerio = require("cheerio");
const { existsSync } = require("fs");
const { open } = require("fs/promises");

const MIN_ID = 1;
const MAX_ID = 250000;

const CACHE = ".cache";

async function downloadAndCacheWhisky(id, filename) {
  const url = `https://www.whiskybase.com/whiskies/whisky/${id}/`;
  let data = "";
  let status = 0;
  try {
    const req = await fetch(url);
    status = req.status;
    data = await req.text();
  } catch (err) {
    status = err.response.status;
    if (code !== 404) {
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
async function scrapeWhisky(id) {
  console.log(`Processing Whisky ${id}`);

  const filename = `${CACHE}/${id}.html`;
  let data = "",
    status = 0;
  if (!existsSync(filename)) {
    console.log(`[Whisky ${id}] Cache not found, fetching from internet`);
    ({ data, status } = await downloadAndCacheWhisky(id, filename));
  } else {
    const fs = await open(filename, "r");
    ({ data, status } = JSON.parse(await fs.readFile()));
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

  const $ = cheerio.load(data);

  const bottle = {};

  const headerEl = $("header > h1").first();
  bottle.brand = {
    name: headerEl.find("a").first().text(),
  };
  bottle.name = headerEl.get()[0]?.lastChild?.data.trim();
  console.log(
    `[Whisky ${id}] Identified as ${bottle.brand.name} - ${bottle.name}`
  );

  bottle.category = mapCategory($("dt:contains('Category') + dd").text());

  const maybeRegion = $("ul.breadcrumb > li:nth-child(3)").text();
  const region = maybeRegion !== bottle.brand.name ? maybeRegion : null;

  bottle.producer = {
    name: $("dt:contains('Distillery') + dd").text(),
    country: $("ul.breadcrumb > li:nth-child(2)").text(),
    region,
  };

  bottle.bottler = {
    name: $("dt:contains('Bottler') + dd").text(),
  };
  bottle.series = $("dt:contains('Bottling serie') + dd").text();

  bottle.vintageYear = parseYear($("dt:contains('Vintage') + dd").text());
  bottle.bottleYear = parseYear($("dt:contains('Bottled') + dd").text());

  bottle.caskType = $("dt:contains('Casktype') + dd").text();
  bottle.caskNumber = $("dt:contains('Casktype') + dd").text();

  bottle.abv = parseAbv($("dt:contains('Strength') + dd").text());

  console.log(bottle);

  return bottle;
}

function parseAbv(value) {
  if (!value || value === "") return;
  const amt = value.split(" % ")[0];
  const abv = parseInt(amt * 10, 10) / 100;
  if (!abv) {
    console.warn(`Unable to parse abv: ${value}`);
    return;
  }
  return abv;
}

function parseYear(value) {
  if (!value || value === "") return;
  const bits = value.split(".");
  const year = bits[bits.length - 1];
  if (year.length !== 4) {
    console.warn(`Could not parse year: ${value}`);
    return;
  }
  return year;
}

function mapCategory(value) {
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
      submitBottle(bottle);
      numTasks -= 1;
    })();

    // short circuit temp. if you find this in git it shouldnt be there!
    break;

    while (numTasks >= maxTasks - 1) {
      await sleep(100);
    }
    currentId += 1;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const API_SERVER = process.env.API_SERVER;

async function submitBottle(bottle) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TOKEN}`,
  };

  console.log(bottle);

  const resp = await fetch(`${API_SERVER}/bottles`, {
    method: "POST",
    body: JSON.stringify(bottle),
    headers,
  });
  if (resp.status !== 201) {
    const data = await resp.json();
    throw new Error(
      `Failed to submit bottle: ${JSON.stringify(data, null, 2)}`
    );
  }
}

scrape();
