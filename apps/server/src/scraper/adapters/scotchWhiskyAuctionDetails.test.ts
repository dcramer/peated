import { parseScotchWhiskyAuctionDetails } from "./scotchWhiskyAuctionDetails";

// Public fact paragraphs and selectors checked on both the 157th and 183rd auction pages on 2026-10-01.
const ardbegDetailPage = `<main><h1>Ardbeg 2009 14 Year Old Single Cask #3771 Feis Ile 2024</h1>
<div class="lotinfo"><p class="bidinfo won">Winning bid: £340</p><div class="descr">
<p>Distilled: 02.07.2009</p><p>Bottled: 18.10.2023</p>
<p>Cask Type: 2nd Fill Pedro Ximénez Sherry Butt</p><p>Cask Number: 3771</p>
<p>59% ABV / 70cl</p><p>Bottle Number: 573 / 633</p></div></div>
<input id="chartx" value="157,183"><input id="charty" value="540,340"></main>`;

test("reads explicit bottle facts, not a lot's individual bottle number or price graph", () => {
  const parsed = parseScotchWhiskyAuctionDetails(ardbegDetailPage);
  expect(parsed).toMatchObject({
    name: "Ardbeg 2009 14 Year Old Single Cask #3771 Feis Ile 2024",
    volume: 700,
    sourceBottleIdentity: {
      cask_number: "3771",
      abv: 59,
      vintage_year: 2009,
      bottling_year: 2023,
      outturn: 633,
      maturation: null,
      release_year: null,
      stated_age: null,
      edition: null,
    },
  });
  expect(Object.keys(parsed)).toEqual([
    "name",
    "volume",
    "sourceBottleIdentity",
  ]);
});

test("unknown, invalid, or conflicting facts are not guessed", () => {
  expect(
    parseScotchWhiskyAuctionDetails(
      ardbegDetailPage
        .replace("02.07.2009", "31.02.2009")
        .replace("18.10.2023", "2022/2023")
        .replace("573 / 633", "700 / 633")
        .replace("59% ABV / 70cl", "unknown% ABV / 70cl"),
    ),
  ).toMatchObject({
    volume: null,
    sourceBottleIdentity: {
      vintage_year: null,
      outturn: null,
      abv: null,
    },
  });
  expect(() =>
    parseScotchWhiskyAuctionDetails(
      ardbegDetailPage.replace(
        "</div></div>",
        "<p>Cask Number: 3773</p></div></div>",
      ),
    ),
  ).toThrow(/Conflicting/);
  expect(() =>
    parseScotchWhiskyAuctionDetails("<main><h1>Age verification</h1></main>"),
  ).toThrow(/missing/);
  expect(
    parseScotchWhiskyAuctionDetails(
      '<main><h1>Unclear whisky</h1><div class="lotinfo"><div class="descr"><p>A story about a whisky from 2009 at 59%.</p></div></div></main>',
    ),
  ).toMatchObject({ volume: null, sourceBottleIdentity: null });
});
