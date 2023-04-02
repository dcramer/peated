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
    console.warn("[Whisky ${id}] Does not exist");
    return;
  }

  //   <h1>
  //     <a href="https://www.whiskybase.com/whiskies/brand/81357/balvenie">
  //       <span>Balvenie</span>
  //     </a>
  //     14-year-old Roasted Malt
  //   </h1>;

  const $ = cheerio.load(data);

  const headerEl = $("header > h1").first();
  const whiskyBrand = headerEl.find("a").first().text();
  const whiskyName = headerEl.get()[0]?.lastChild?.data.trim();
  console.log(`[Whisky ${id}] Identified as ${whiskyBrand} - ${whiskyName}`);
}

async function scrape() {
  let currentId = MIN_ID;
  while (currentId < MAX_ID) {
    await scrapeWhisky(currentId);
    currentId += 1;
  }
}

scrape();
