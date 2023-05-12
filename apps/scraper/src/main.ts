import { load as cheerio } from 'cheerio'
import { open } from 'fs/promises'
import { PageNotFound, getUrl } from './scraper'

async function scrapeWhisky(id: number) {
  console.log(`Processing Whisky ${id}`)

  const data = await getUrl(`https://www.whiskybase.com/whiskies/whisky/${id}/`)
  if (!data) {
    console.warn(`[Whisky ${id}] Does not exist`)
    return
  }

  //   <h1>
  //     <a href="https://www.whiskybase.com/whiskies/brand/81357/balvenie">
  //       <span>Balvenie</span>
  //     </a>
  //     14-year-old Roasted Malt
  //   </h1>;

  const $ = cheerio(data)

  const bottle: any = {}

  const headerEl = $('header > h1').first()

  const brandName = headerEl.find('a').first().text()

  const maybeRegion = $('ul.breadcrumb > li:nth-child(3)').text()
  const region = maybeRegion !== brandName ? maybeRegion : null

  bottle.brand = {
    name: brandName,
    country: $('ul.breadcrumb > li:nth-child(2)').text(),
    region,
  }
  bottle.name = parseName(brandName, headerEl.get()[0]?.lastChild?.data.trim())

  bottle.category = mapCategory($("dt:contains('Category') + dd").text())

  bottle.distiller = {
    name: $("dt:contains('Distillery') + dd").text(),
    country: bottle.brand.country,
    region,
  }

  // bottle.bottler = {
  //   name: $("dt:contains('Bottler') + dd").text(),
  // };
  // bottle.series = $("dt:contains('Bottling serie') + dd").text();

  // bottle.vintageYear = parseYear($("dt:contains('Vintage') + dd").text());
  // bottle.bottleYear = parseYear($("dt:contains('Bottled') + dd").text());

  // bottle.caskType = $("dt:contains('Casktype') + dd").text();
  // bottle.caskNumber = $("dt:contains('Casknumber') + dd").text();

  bottle.abv = parseAbv($("dt:contains('Strength') + dd").text())

  console.log(`[Whisky ${id}] Identified as ${bottle.name} - ${bottle.series}`)

  return bottle
}

// e.g. https://www.whiskybase.com/whiskies/distillery/2
async function scrapeDistiller(id: number) {
  console.log(`Processing Distiller ${id}`)

  const data = await getUrl(
    `https://www.whiskybase.com/whiskies/distillery/${id}/about`,
  )

  const $ = cheerio(data)

  const result = {
    name: $('#company-name > h1').text(),
    country: $('ul.breadcrumb > li:first-child').text(),
    region: $('ul.breadcrumb > li:last-child').text(),
  }

  let bottleCount = 0
  $('.company-details > ul > li:first-child').each((_, el) => {
    if ($('.title', el).text() === 'Whiskies') {
      bottleCount = parseInt($('.value', el).text(), 10)
    }
  })

  console.log(
    `[Distiller ${id}] Identified as ${result.name} (${result.country} - ${result.region}) with ${bottleCount} bottles.`,
  )
  if (bottleCount < 20) {
    console.warn('Discarding Distillery as low quality risk')
    return null
  }

  return result
}

// e.g. https://www.whiskybase.com/whiskies/brand/2
async function scrapeBrand(id: number) {
  console.log(`Processing Brand ${id}`)

  const data = await getUrl(
    `https://www.whiskybase.com/whiskies/brand/${id}/about`,
  )

  const $ = cheerio(data)

  const result = {
    name: $('#company-name > h1').text(),
    country: $('ul.breadcrumb > li:first-child').text(),
    region: $('ul.breadcrumb > li:last-child').text(),
  }

  let bottleCount = 0
  $('.company-details > ul > li:first-child').each((_, el) => {
    if ($('.title', el).text() === 'Whiskies') {
      bottleCount = parseInt($('.value', el).text(), 10)
    }
  })

  console.log(
    `[Brand ${id}] Identified as ${result.name} (${result.country} - ${result.region}) with ${bottleCount} bottles.`,
  )
  if (bottleCount < 20) {
    console.warn('Discarding Brand as low quality risk')
    return null
  }

  return result
}

function parseName(brandName: string, bottleName: string) {
  const bottleNameWithoutAge = bottleName.split('-year-old')[0]
  if (bottleNameWithoutAge !== bottleName) {
    bottleName = `${brandName} ${bottleNameWithoutAge}`
  }
  return bottleName
}

function parseAbv(value: string) {
  if (!value || value === '') return
  const amt = value.split(' % ')[0]
  const abv = parseInt(amt * 10, 10) / 100
  if (!abv) {
    console.warn(`Unable to parse abv: ${value}`)
    return
  }
  return abv
}

function parseYear(value: string) {
  if (!value || value === '') return
  const bits = value.split('.')
  const year = bits[bits.length - 1]
  if (year.length !== 4) {
    console.warn(`Could not parse year: ${value}`)
    return
  }
  return year
}

function mapCategory(value: string) {
  return value.toLowerCase().replace(' ', '_')
}

// async function scrapeBottles() {
//   const maxTasks = 8;

//   let numTasks = 0;
//   let currentId = MIN_ID;
//   while (currentId < MAX_ID) {
//     numTasks += 1;
//     (async () => {
//       try {
//         const bottle = await scrapeWhisky(currentId);
//         if (bottle) {
//           // await submitBrand(bottle.brand);
//           // await submitDistiller(bottle.distiller);
//           // await submitBottle(bottle);
//         }
//       } catch (err) {
//         console.error(err);
//       }
//       numTasks -= 1;
//     })();

//     while (numTasks >= maxTasks - 1) {
//       await sleep(100);
//     }
//     currentId += 1;
//   }
// }

async function scrape(cb: (id: number) => Promise<void>) {
  const maxTasks = 8

  let numTasks = 0
  let currentId = 1
  let repeatFailures = 0

  while (repeatFailures < 10000) {
    numTasks += 1
    ;(async () => {
      try {
        await cb(currentId)
        repeatFailures = 0
      } catch (err) {
        if (err instanceof PageNotFound) {
          repeatFailures += 1
        } else {
          console.error(err)
        }
      }
      numTasks -= 1
    })()

    while (numTasks >= maxTasks) {
      await sleep(100)
    }
    currentId += 1
  }
}

async function scrapeDistillers() {
  const distillerList: any[] = []
  await scrape(async (id) => {
    const result = await scrapeDistiller(id)
    if (result) distillerList.push(result)
  })

  console.log(`Found ${distillerList.length} distillers`)
  saveResults('distillers.json', distillerList)
}

async function scrapeBrands() {
  const brandList: any[] = []
  await scrape(async (id) => {
    const result = await scrapeBrand(id)
    if (result) brandList.push(result)
  })

  console.log(`Found ${brandList.length} brands`)
  saveResults('brands.json', brandList)
}

async function saveResults(filename: string, results: any) {
  const fs = await open(filename, 'w')
  await fs.writeFile(JSON.stringify(results, undefined, 2))
  await fs.close()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  await scrapeDistillers()
  await scrapeBrands()
}

main()
