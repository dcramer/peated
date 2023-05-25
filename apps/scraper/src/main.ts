import { load as cheerio } from "cheerio";
import { open } from "fs/promises";
import { getUrl } from "./scraper";

async function scrapeBottle(id: number) {
  console.log(`Processing Bottle ${id}`);

  const data = await getUrl(
    `https://www.whiskybase.com/whiskies/whisky/${id}/`,
  );
  if (!data) {
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

  bottle.votes = parseFloat(
    $("#partial-aggregate-rating dd.votes-count").first().text(),
  );

  bottle.brand = {
    name: brandName,
  };
  bottle.name = parseName(brandName, headerEl.get()[0]?.lastChild?.data.trim());

  bottle.category = mapCategory(
    $("dt:contains('Category') + dd").first().text(),
  );

  const distillerName = $("dt:contains('Distillery') + dd > a").first().text();
  bottle.distiller = distillerName
    ? {
        name: distillerName,
      }
    : null;

  const bottlerName = $("dt:contains('Bottler') + dd > a").first().text();
  bottle.bottler = bottlerName
    ? {
        name: bottlerName,
      }
    : null;
  bottle.series = $("dt:contains('Bottling serie') + dd").first().text();

  bottle.vintageYear = parseYear(
    $("dt:contains('Vintage') + dd").first().text(),
  );
  bottle.bottleYear = parseYear(
    $("dt:contains('Bottled') + dd").first().text(),
  );

  bottle.caskType = $("dt:contains('Casktype') + dd").first().text();
  bottle.caskNumber = $("dt:contains('Casknumber') + dd").first().text();

  bottle.abv = parseAbv($("dt:contains('Strength') + dd").first().text());

  console.log(`[Whisky ${id}] Identified as ${bottle.name} - ${bottle.series}`);

  return bottle;
}

// e.g. https://www.whiskybase.com/whiskies/distillery/2
async function scrapeDistiller(id: number) {
  console.log(`Processing Distiller ${id}`);

  const data = await getUrl(
    `https://www.whiskybase.com/whiskies/distillery/${id}/about`,
  );

  const $ = cheerio(data);

  const maybeRegion = $("ul.breadcrumb > li:last-child").text();
  const country = $("ul.breadcrumb > li:first-child").text();

  const result = {
    name: $("#company-name > h1").text(),
    country,
    region: maybeRegion !== country ? maybeRegion : null,
  };

  console.log(
    `[Distiller ${id}] Identified as ${result.name} (${result.country} - ${result.region})`,
  );

  return result;
}

// e.g. https://www.whiskybase.com/whiskies/brand/2
async function scrapeBrand(id: number) {
  console.log(`Processing Brand ${id}`);

  const data = await getUrl(
    `https://www.whiskybase.com/whiskies/brand/${id}/about`,
  );

  const $ = cheerio(data);

  const maybeRegion = $("ul.breadcrumb > li:last-child").text();
  const country = $("ul.breadcrumb > li:first-child").text();

  const result = {
    name: $("#company-name > h1").text(),
    country,
    region: maybeRegion !== country ? maybeRegion : null,
  };

  console.log(
    `[Brand ${id}] Identified as ${result.name} (${result.country} - ${result.region})`,
  );
  return result;
}

// e.g. https://www.whiskybase.com/whiskies/bottlers/2
async function scrapeBottler(id: number) {
  console.log(`Processing Bottler ${id}`);

  const data = await getUrl(
    `https://www.whiskybase.com/whiskies/bottler/${id}/about`,
  );

  const $ = cheerio(data);

  const maybeRegion = $("ul.breadcrumb > li:last-child").text();
  const country = $("ul.breadcrumb > li:first-child").text();

  const result = {
    name: $("#company-name > h1").text(),
    country,
    region: maybeRegion !== country ? maybeRegion : null,
  };

  console.log(
    `[Bottler ${id}] Identified as ${result.name} (${result.country} - ${result.region})`,
  );
  return result;
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
  const abv = parseFloat(amt);
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
  return value.toLowerCase().replace(" ", "_");
}

// https://www.whiskybase.com/whiskies/distilleries?style=table&search=null&chr=null&country_id=&region_id=&wbRanking=&sort=companies.name&direction=asc&h=companies.country,companies.whiskies,style
async function scrapeTable(
  url: string,
  cb: (url: string, bottleCount: number) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  const results: [string, number][] = [];
  $("tbody > tr").each(async (_, el) => {
    const href = $("td > a", el).attr("href");
    const bottleCount = parseInt($("td:nth-child(3)", el).text() || "0", 10);
    if (href) results.push([href, bottleCount]);
  });
  for (const result of results) {
    await cb(...result);
  }
}

async function scrapeDistillers() {
  const tableUrl =
    "https://www.whiskybase.com/whiskies/distilleries?style=table&search=null&chr=null&wbRanking=&sort=companies.name&direction=asc&h=companies.country,companies.whiskies,style";
  const results: any[] = [];
  await scrapeTable(tableUrl, async (url, totalBottles) => {
    if (totalBottles < 20) {
      console.warn(`Discarding ${url} - too few bottles`);
      return;
    }
    const match = url.match(/\/distillery\/(\d+)\//);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const result = await scrapeDistiller(id);
    if (result) results.push(result);
  });

  console.log(`Found ${results.length} distillers`);
  saveResults("distillers.json", results);
}

async function scrapeBrands() {
  const tableUrl =
    "https://www.whiskybase.com/whiskies/brands?style=table&search=null&chr=null&wbRanking=&sort=companies.name&direction=asc&h=companies.country,companies.whiskies,style";
  const results: any[] = [];
  await scrapeTable(tableUrl, async (url, totalBottles) => {
    if (totalBottles < 5) {
      console.warn(`Discarding ${url} - too few bottles`);
      return;
    }

    const match = url.match(/\/brand\/(\d+)\//);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const result = await scrapeBrand(id);
    if (result) results.push(result);
  });

  console.log(`Found ${results.length} brands`);
  saveResults("brands.json", results);
}

async function scrapeBottlers() {
  const tableUrl =
    "https://www.whiskybase.com/whiskies/bottlers?search=null&chr=null&country_id=&region_id=&wbRanking=&sort=companies.country,companies.whiskies&direction=desc";
  const results: any[] = [];
  await scrapeTable(tableUrl, async (url, totalBottles) => {
    if (totalBottles < 5) {
      console.warn(`Discarding ${url} - too few bottles`);
      return;
    }

    const match = url.match(/\/bottler\/(\d+)\//);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const result = await scrapeBottler(id);
    if (result) results.push(result);
  });

  console.log(`Found ${results.length} bottlers`);
  saveResults("bottlers.json", results);
}

async function scrapeBottleTable(
  url: string,
  cb: (url: string) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  const results: [string][] = [];
  $("tbody > tr").each(async (_, el) => {
    const href = $("td:nth-child(2) > a", el).attr("href");
    if (href) results.push([href]);
  });
  for (const result of results) {
    await cb(...result);
  }
}

async function scrapeBottles() {
  const years = [...Array(100).keys()].map((i) => 2023 - i);
  const results: any[] = [];
  for (const year of years) {
    const tableUrl = `https://www.whiskybase.com/whiskies/new-releases?bottle_date_year=${year}&sort=whisky.name&direction=asc`;
    console.log(tableUrl);
    await scrapeBottleTable(tableUrl, async (url) => {
      const match = url.match(/\/whisky\/(\d+)\//);
      if (!match) return;
      const id = parseInt(match[1], 10);
      try {
        const result = await scrapeBottle(id);
        if (result.votes < 100) {
          console.warn(`Discarding ${url} - too few votes`);
          return;
        }
        if (result) results.push(result);
      } catch (err) {
        console.error(err);
      }
    });
  }

  console.log(`Found ${results.length} bottles`);
  saveResults("bottles.json", results);
}

async function saveResults(filename: string, results: any) {
  const fs = await open(filename, "w");
  await fs.writeFile(JSON.stringify(results, undefined, 2));
  await fs.close();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // await scrapeDistillers();
  // await scrapeBrands();
  // await scrapeBottlers();
  await scrapeBottles();
}

main();
