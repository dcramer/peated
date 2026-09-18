# Catalog Research

Use this guide to find and assess evidence for catalog maintenance. Exact, dated
results from individual tasks live under `docs/research/catalog/`.

## Look In This Order

1. Producer: current products, past releases, news, menus, trade pages, PDFs,
   sitemaps, shops, and country sites.
2. Broad whisky catalog: use it to find likely gaps.
3. Exact proof: producer page, dated announcement, readable label, distributor
   page, or exact auction lot.
4. Other names and markets: old names, local languages, travel retail, private
   picks, and sold-out pages.
5. Record what was searched, what years and markets were covered, and what is
   still unknown.

For a large, cask-heavy catalog, keep two independent inventories: the expected
release inventory from outside sources and the complete Peated scope fetched by
every relevant relationship. Partition the release inventory by vintage or
distillation year and by marketed range. Reconcile both directions after every
batch of changes. Names alone are not stable enough for this comparison; use
the exact combination of producer, age or NAS, vintage, bottling year, ABV,
edition, cask number, and Series when those facts are known.

## Best Places To Search

| Place                              | Good for                                   | Watch for                                                 |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| Producer product archive           | Names, ranges, facts, images               | Current pages omit old releases                           |
| Producer news                      | Launch dates and new ranges                | Later articles may shorten details                        |
| Producer PDF or menu               | Dense lists, batches, casks, strengths     | Menu date is not release date                             |
| Sitemap or public shop data        | Sold-out and hidden product pages          | Check terms; remove bundles and package variants          |
| Country distributor                | Market-only releases and official images   | Covers one market only                                    |
| Government label database          | Label art, proof, age, applicant           | Approval does not prove release                           |
| Whisky catalog or collector list   | Large historical lists                     | Use as a lead; check the exact Bottle                     |
| Exact auction lot                  | Front/back labels, cask, ABV, bottle count | Seller titles and auction dates can mislead               |
| Old retailer page                  | Discontinued and exclusive Bottles         | Listing date is not always release date                   |
| Whisky review or news article      | Dated proof and old names                  | Secondary source; check conflicts                         |
| Wikimedia Commons file page        | Reusable distillery images and license     | Exact Bottle images are rare                              |
| Openverse or Flickr license search | Reusable user Bottle photos                | Verify the live source, creator, license, and exact label |

## Pages Worth Trying

- `sitemap.xml` and product sitemaps
- `/products.json?limit=250`
- `/collections/<name>/products.json`
- Individual Shopify product `.js` pages
- Sold-out product pages
- Past releases, archive, history, news, and trade-support pages
- Regional shops and local-language sites
- Linked PDFs, bar menus, release books, and press pages
- WordPress product sitemaps such as `product-sitemap.xml`, which list
  discontinued product pages; fetch them one at a time, because security
  plugins block parallel requests
- Wayback captures of a producer's earlier product site and news pages when
  its current news archive starts late. Fetch the archived spec and special
  pages by path (Kanosuke kept full cask sheets at `/special/<slug>/` and
  announcement text on `/news/<year>/`); the capture lookup API returns 429
  when called in parallel, so pace requests one at a time

Do not bypass access controls. Search snippets, thumbnails, copied images, and
direct image links are leads only. Save the page that explains the item.

## Sources That Worked Often

| Source                                                                      | Most useful for                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky)      | Brand, distillery, and range lists; exact label photos          |
| [Whisky.Auction Magazine](https://magazine.whisky.auction/)                 | Rare Malts, Diageo Special Releases, and Lagavulin label guides |
| [Whisky Hunter](https://whiskyhunter.net/base/)                             | Old range searches, especially Rare Malts                       |
| [Buxrud Rare Malts list](https://www.buxrud.se/raremalt.htm)                | Rare Malts cross-check                                          |
| [Whiskybase](https://www.whiskybase.com/)                                   | Finding historical gaps, names, and casks                       |
| [Spirit Radar](https://www.spiritradar.com/)                                | Broad brand indexes and obscure presentation-bottle leads       |
| [The Whisky Exchange](https://www.thewhiskyexchange.com/)                   | Old products and retailer exclusives                            |
| [Master of Malt](https://www.masterofmalt.com/)                             | Old products, casks, and readable labels                        |
| [Whiskyfun](https://www.whiskyfun.com/)                                     | Long-running distillery and review archives                     |
| [Whisky-news](https://www.whisky-news.com/En/distilleries/)                 | Distillery release lists                                        |
| [Sotheby's whisky articles](https://www.sothebys.com/en/articles/whisky)    | Collector guides and old collections                            |
| [TTB COLA](https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do) | US label approvals                                              |
| [Wikimedia Commons](https://commons.wikimedia.org/)                         | Licensed distillery photos                                      |
| [Japanese Whisky Information Center](https://jwic.jp/)                      | Year-by-year release timelines for Japanese distilleries        |
| [Kyodo PR Wire](https://kyodonewsprwire.jp/)                                | Japanese producer press releases with dates, ABV, and outturns  |

Whiskybase was useful in many tasks, but Peated must not collect or copy it
automatically. See the
[source access audit](../research/external-review-source-audit-2026-08.md).
Whisky Auctioneer, The Whisky Exchange, Whisky Hammer, K&L, Master of Malt,
and Casa de Vinos block or rate-limit fetch tools (406, 403, 429); read them
in a browser and treat search snippets of their pages as leads only.
Spirit Radar was useful as a manually reviewed lead index for Yamazaki. Its
brand page mixed proper releases, packaging variants, tasting samples, and
misattributed Suntory bottles, so every exact identity required independent
producer, auction, or retailer evidence.

## Common Mistakes

- A current range is not the full catalog.
- One country site is not the worldwide catalog.
- A distillery name is not the only way its historical releases were branded.
  Check former owner and house brands, domestic blends, and local-language
  labels, then require evidence that the distillery made the whisky in scope.
- One auction or shop row is not always a separate release.
- Gift boxes, bottle sizes, wax colors, and label changes often use the same
  whisky.
- A person's, hotel, bar, retailer, importer, or private-cask customer's name
  on a label does not establish a Bottler. Look for evidence that a business
  independently selected and released the whisky.
- Shared artwork or packaging does not establish a BottleSeries. Confirm a
  named range, its Brand, and each member; split similarly named ranges when the
  Brand changes.
- Labels can be more accurate than page text.
- Auction, shop, image, approval, distillation, and bottling dates are not
  release dates.
- An undated retailer shipping month does not inherit the current calendar
  year. Check a dated producer announcement before storing the year.
- Private picks and single casks often have no complete public list.
- Specialist-catalog bottler abbreviations such as Whiskybase's `Gs` are source
  notation, not marketed Bottle names. Keep them only as import references, and
  check for collisions before treating the complete reference as exact.
- An SMWS cask code owns the release identity. A legacy reference that combines
  one release's code with another release's subtitle is not evidence of an old
  title; verify both parts against exact producer pages before assigning it.
- Collector indexes can contain fabricated or misidentified lead entries. Verify
  the exact label against an independent auction, producer, or retailer source
  before creating a Bottle; a plausible old date and name are not evidence.
- An exact image may still lack permission for Peated to store it.
- Creating an Entity with an address triggers geocoding that can replace the
  address with a wrong street. Re-read the Entity and correct the address and
  coordinates.
- A shared Bottle rename fans out to every Bottle in its group. Read the edit
  context first and give each member its own edition in the same pass.
- A direct image URL does not record its source page or license. Count image
  identity, source-page provenance, and reuse status separately in the final
  audit.
- A geocoder can send a Japanese place name to the wrong prefecture (Kanosuke's
  Kaminokawa in Hioki was pinned to Kaminokawa, Tochigi). Check Entity
  coordinates against the producer's address after any address write.
- An importer's "bottles for the US" count is an allocation, not the outturn.
  A label photo on the importer's page can settle a cask-number conflict
  between the importer's text and resellers.

## Write The Research Record

The dated file under `docs/research/catalog/` is a guide to where the
information for that scope lives, written for the next person who researches
it. It is not a log of the writes: Peated's change history records every
create, patch, and merge, and the final report and pull request describe the
pass.

Keep:

- each source that held facts for the scope, with its link, the families and
  years it covers, what it proves, and where it stops;
- the sources that block tools or need a browser, and any pacing limit;
- the conflicts found between sources and which value was used, so the next
  pass does not settle them again;
- the searches and sites that found nothing;
- image reuse terms per site;
- the releases and facts still unknown, with the question each leaves open.

Leave out: production IDs and counts, per-Bottle field lists, raw API replies,
downloaded images, tokens, and request files. Name a Bottle only when a fact
about it needs its source to be found again (a Wayback capture URL, a label
photo on an importer page). Put a reusable method, access limit, or recurring
trap in this guide instead of the record.
