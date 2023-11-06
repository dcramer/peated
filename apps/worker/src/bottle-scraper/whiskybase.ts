import { load as cheerio } from "cheerio";
import { open } from "fs/promises";

import { normalizeBottleName } from "@peated/server/lib/normalize";

import { getUrl } from "../scraper";

function fixDistillerName(name: string) {
  switch (name) {
    case "Macallan":
      return "The Macallan";

    case "Balvenie":
      return "The Balvenie";

    case "1770":
      return "Glasgow 1770";

    default:
      return name;
  }
}

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

  const brandName = fixDistillerName(headerEl.find("a").first().text());

  bottle.votes = parseFloat(
    $("#partial-aggregate-rating dd.votes-count").first().text(),
  );

  bottle.brand = {
    name: brandName,
  };

  // TODO(dcramer): not sure this still works
  bottle.name = normalizeBottleName(
    parseName(brandName, headerEl.first().last().text().trim()),
  );

  bottle.category = mapCategory(
    $("dt:contains('Category') + dd").first().text(),
  );

  const distillerName = $("dt:contains('Distillery') + dd a").first().text();
  bottle.distiller = distillerName
    ? {
        name: fixDistillerName(distillerName),
      }
    : null;

  const bottlerName = $("dt:contains('Bottler') + dd a").first().text();
  if (
    !bottlerName &&
    bottle.distiller &&
    $("dt:contains('Bottler') + dd").first().text() === "Distillery Bottling"
  ) {
    bottle.bottler = bottle.distiller;
  } else {
    bottle.bottler = bottlerName
      ? {
          name: fixDistillerName(bottlerName),
        }
      : null;
  }

  const series = $("dt:contains('Bottling serie') + dd").first().text() || null;
  if (series) bottle.name = `${bottle.name} ${series}`;

  const ageData = $("dt:contains('Stated Age') + dd")
    .first()
    .text()
    .split(" ")[0];
  bottle.statedAge = parseInt(ageData, 10) >= 3 ? parseInt(ageData, 10) : null;

  bottle.vintageYear = parseYear(
    $("dt:contains('Vintage') + dd").first().text(),
  );
  bottle.bottleYear = parseYear(
    $("dt:contains('Bottled') + dd").first().text(),
  );

  bottle.caskType = $("dt:contains('Casktype') + dd").first().text();
  bottle.caskNumber = $("dt:contains('Casknumber') + dd").first().text();

  bottle.abv = parseAbv($("dt:contains('Strength') + dd").first().text());

  console.log(
    `[Whisky ${id}] Identified as ${bottle.brand.name} - ${bottle.name}`,
  );

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
  const result = value.toLowerCase().replace(" ", "_");
  switch (result) {
    case "blended_scotch":
    case "blended_malt":
    case "blend":
      return "blend";
    case "single_malt":
    case "single_grain":
    case "bourbon":
    case "rye":
    case "spirit":
      return result;
    default:
      return null;
  }
}

// https://www.whiskybase.com/whiskies/distilleries?style=table&search=null&chr=null&country_id=&region_id=&wbRanking=&sort=companies.name&direction=asc&h=companies.country,companies.whiskies,style
async function scrapeTable(
  url: string,
  cb: (url: string, bottleCount: number) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  const results: [string, number][] = [];
  $("tbody > tr").each((_, el) => {
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
  $("tbody > tr").each((_, el) => {
    const href = $("td:nth-child(2) > a", el).attr("href");
    if (href) results.push([href]);
  });
  for (const result of results) {
    await cb(...result);
  }
}

async function scrapeBottles() {
  const years = [...Array(100).keys()].map((i) => 2023 - i);
  // const years = [2022, 2023];
  const results: any[] = [];
  const bottleDedupeSet: Record<string, any> = {};
  for (const year of years) {
    const tableUrl = `https://www.whiskybase.com/whiskies/new-releases?bottle_date_year=${year}&sort=whisky.name&direction=asc`;
    console.log(tableUrl);
    await scrapeBottleTable(tableUrl, async (url) => {
      const match = url.match(/\/whisky\/(\d+)\//);
      if (!match) return;
      const id = parseInt(match[1], 10);
      try {
        const result = await scrapeBottle(id);
        const bottleId = `${result.brand.name} - ${result.name} - ${
          result.series || ""
        }`;
        if (!bottleDedupeSet[bottleId]) {
          bottleDedupeSet[bottleId] = {
            ...result,
            ids: [id],
          };
          results.push(bottleDedupeSet[bottleId]);
        } else {
          bottleDedupeSet[bottleId].votes += result.votes;
          bottleDedupeSet[bottleId].ids.push(id);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  const keepBottles = results
    // discard low votes as the data might be bad
    .filter((v) => v.votes >= 100);
  // // discard series specific stuff (for now)
  // .filter((v) => v.series === null);

  console.log(
    `Found ${results.length} bottles - keeping ${keepBottles.length}`,
  );
  saveResults("bottles.json", keepBottles);
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

if (typeof require !== "undefined" && require.main === module) {
  main();
}
