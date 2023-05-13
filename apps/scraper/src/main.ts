import { load as cheerio } from "cheerio";
import { open } from "fs/promises";
import { getUrl } from "./scraper";

async function scrapeWhisky(id: number) {
  console.log(`Processing Whisky ${id}`);

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
  // bottle.series = $("dt:contains('Bottling serie') + dd").text();

  // bottle.vintageYear = parseYear($("dt:contains('Vintage') + dd").text());
  // bottle.bottleYear = parseYear($("dt:contains('Bottled') + dd").text());

  // bottle.caskType = $("dt:contains('Casktype') + dd").text();
  // bottle.caskNumber = $("dt:contains('Casknumber') + dd").text();

  bottle.abv = parseAbv($("dt:contains('Strength') + dd").text());

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

  const result = {
    name: $("#company-name > h1").text(),
    country: $("ul.breadcrumb > li:first-child").text(),
    region: $("ul.breadcrumb > li:last-child").text(),
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

  const result = {
    name: $("#company-name > h1").text(),
    country: $("ul.breadcrumb > li:first-child").text(),
    region: $("ul.breadcrumb > li:last-child").text(),
  };

  console.log(
    `[Brand ${id}] Identified as ${result.name} (${result.country} - ${result.region})`,
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
    const href = $("td:first-child > a", el).attr("href");
    const bottleCount = parseInt($("td:nth-child(3)", el).text() || "0", 10);
    if (href) results.push([href, bottleCount]);
  });
  for (const result of results) {
    await cb(...result);
  }
}

async function scrapeDistillers() {
  const tableUrl =
    "https://www.whiskybase.com/whiskies/distilleries?style=table&search=null&chr=null&country_id=&region_id=&wbRanking=&sort=companies.name&direction=asc&h=companies.country,companies.whiskies,style";
  const distillerList: any[] = [];
  await scrapeTable(tableUrl, async (url, totalBottles) => {
    if (totalBottles < 20) {
      console.warn(`Discarding ${url} - too few bottles`);
      return;
    }
    const match = url.match(/\/distillery\/(\d+)\//);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const result = await scrapeDistiller(id);
    if (result) distillerList.push(result);
  });

  console.log(`Found ${distillerList.length} distillers`);
  saveResults("distillers.json", distillerList);
}

async function scrapeBrands() {
  const tableUrl =
    "https://www.whiskybase.com/whiskies/brands?style=table&search=null&chr=null&country_id=&region_id=&wbRanking=&sort=companies.name&direction=asc&h=companies.country,companies.whiskies,style";
  const distillerList: any[] = [];
  await scrapeTable(tableUrl, async (url, totalBottles) => {
    if (totalBottles < 20) {
      console.warn(`Discarding ${url} - too few bottles`);
      return;
    }

    const match = url.match(/\/brand\/(\d+)\//);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const result = await scrapeBrand(id);
    if (result) distillerList.push(result);
  });

  console.log(`Found ${distillerList.length} brands`);
  saveResults("brands.json", distillerList);
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
  await scrapeDistillers();
  await scrapeBrands();
}

main();
