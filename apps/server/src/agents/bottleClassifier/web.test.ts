import type { PageRead } from "@peated/bot";
import { vi } from "vitest";
import { createBottleClassifierWeb } from "./web";

const lotUrl =
  "https://www.scotchwhiskyauctions.com/auctions/234-the-185th-auction/905402-speyside-single-malt-28-year-old-hades-platinum-cask-with-print/";

// Lot 185-02214, read on 2026-11-04. The lot ships in the HTML, then the
// script empties #pagewrap and leaves only the age question.
const lotHtml = `<html><head><title>Speyside Single Malt 28 Year Old Hades Platinum Cask With Print | The 185th Auction | Scotch Whisky Auctions</title></head>
<body><div id="pagewrap"><nav>Menu</nav><main><h1>Speyside Single Malt 28 Year Old Hades Platinum Cask With Print</h1>
<div class="lotinfo"><p class="lotno">Lot number: 185-02214</p><p class="bidinfo curbid">Current winning bid: £25</p>
<div class="bidbox"><p>You must sign in to bid.</p></div><div class="descr">
<p>The Olympians Series from Platinum Cask is a limited release set of 12 single cask bottlings.</p>
<p><strong>Hades - Speyside (Near Dufftown)</strong></p>
<p>Age: 28 Years Old</p><p>52.9% ABV / 70cl</p><p>Bottle Number: 73 / 126</p></div></div></main>
<footer>Scotch Whisky Auctions Ltd</footer></div>
<div class="agewrap"><div id="ageverify"><label>Are you the legal age to buy alcohol in your country?</label></div></div>
<script>document.getElementById('pagewrap').innerHTML = '';</script></body></html>`;

function htmlRead(content: string): PageRead {
  return {
    status: "ok",
    url: lotUrl,
    title: null,
    description: null,
    publishedTime: null,
    content,
    route: "direct",
  };
}

function createBot(read: PageRead) {
  return {
    readPage: vi.fn(async () => read),
    searchWeb: vi.fn(),
  };
}

test("reads a Scotch Whisky Auctions lot page from its HTML, without the age question", async () => {
  const bot = createBot(htmlRead(lotHtml));

  const page = await createBottleClassifierWeb(bot).readPage({
    url: lotUrl,
    format: "markdown",
  });

  expect(bot.readPage).toHaveBeenCalledWith({ url: lotUrl, format: "html" });
  expect(page).toEqual({
    status: "ok",
    url: lotUrl,
    title:
      "Speyside Single Malt 28 Year Old Hades Platinum Cask With Print | The 185th Auction | Scotch Whisky Auctions",
    description: null,
    publishedTime: null,
    route: "direct",
    content: [
      "# Speyside Single Malt 28 Year Old Hades Platinum Cask With Print",
      "Lot number: 185-02214",
      "The Olympians Series from Platinum Cask is a limited release set of 12 single cask bottlings.",
      "Hades - Speyside (Near Dufftown)",
      "Age: 28 Years Old",
      "52.9% ABV / 70cl",
      "Bottle Number: 73 / 126",
    ].join("\n\n"),
  });
});

test("a Scotch Whisky Auctions page without a lot is not found", async () => {
  const bot = createBot(
    htmlRead("<html><body><main><h1>Page not found</h1></main></body></html>"),
  );

  expect(
    await createBottleClassifierWeb(bot).readPage({
      url: lotUrl,
      format: "markdown",
    }),
  ).toEqual({
    status: "failed",
    url: lotUrl,
    reason: "not_found",
    httpStatus: null,
  });
});

test("a refused Scotch Whisky Auctions read is returned as is", async () => {
  const refused: PageRead = {
    status: "refused",
    url: lotUrl,
    reason: "robots_disallowed",
  };
  const bot = createBot(refused);

  expect(
    await createBottleClassifierWeb(bot).readPage({
      url: lotUrl,
      format: "markdown",
    }),
  ).toEqual(refused);
});

test("other pages are read as asked", async () => {
  const read = htmlRead("Hades, a 28-year-old teaspooned Burnside");
  const bot = createBot(read);
  const auctionIndex =
    "https://www.scotchwhiskyauctions.com/auctions/234-the-185th-auction/";

  for (const url of ["https://51wines.uk/products/hades", auctionIndex]) {
    expect(
      await createBottleClassifierWeb(bot).readPage({
        url,
        format: "markdown",
      }),
    ).toEqual(read);
    expect(bot.readPage).toHaveBeenLastCalledWith({ url, format: "markdown" });
  }
});
