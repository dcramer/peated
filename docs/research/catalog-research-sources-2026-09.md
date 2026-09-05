# Finding Whisky Catalogs — September 2026

Reviewed 25 archived catalog tasks and three active ones after scanning 610 task
summaries. This is a starting point, not proof that a site is complete or may be
collected automatically. Recheck terms, access rules, and image rights.

See [Catalog Source Examples](./catalog-research-examples-2026-09.md) for the
sites that worked for each producer or range.

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

## Best Places To Search

| Place                            | Good for                                   | Watch for                                        |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| Producer product archive         | Names, ranges, facts, images               | Current pages omit old releases                  |
| Producer news                    | Launch dates and new ranges                | Later articles may shorten details               |
| Producer PDF or menu             | Dense lists, batches, casks, strengths     | Menu date is not release date                    |
| Sitemap or public shop data      | Sold-out and hidden product pages          | Check terms; remove bundles and package variants |
| Country distributor              | Market-only releases and official images   | Covers one market only                           |
| Government label database        | Label art, proof, age, applicant           | Approval does not prove release                  |
| Whisky catalog or collector list | Large historical lists                     | Use as a lead; check the exact Bottle            |
| Exact auction lot                | Front/back labels, cask, ABV, bottle count | Seller titles and auction dates can mislead      |
| Old retailer page                | Discontinued and exclusive Bottles         | Listing date is not always release date          |
| Whisky review or news article    | Dated proof and old names                  | Secondary source; check conflicts                |
| Wikimedia Commons file page      | Reusable distillery images and license     | Exact Bottle images are rare                     |

## Pages Worth Trying

- `sitemap.xml` and product sitemaps
- `/products.json?limit=250`
- `/collections/<name>/products.json`
- Individual Shopify product `.js` pages
- Sold-out product pages
- Past releases, archive, history, news, and trade-support pages
- Regional shops and local-language sites
- Linked PDFs, bar menus, release books, and press pages

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
| [The Whisky Exchange](https://www.thewhiskyexchange.com/)                   | Old products and retailer exclusives                            |
| [Master of Malt](https://www.masterofmalt.com/)                             | Old products, casks, and readable labels                        |
| [Whiskyfun](https://www.whiskyfun.com/)                                     | Long-running distillery and review archives                     |
| [Whisky-news](https://www.whisky-news.com/En/distilleries/)                 | Distillery release lists                                        |
| [Sotheby's whisky articles](https://www.sothebys.com/en/articles/whisky)    | Collector guides and old collections                            |
| [TTB COLA](https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do) | US label approvals                                              |
| [Wikimedia Commons](https://commons.wikimedia.org/)                         | Licensed distillery photos                                      |

Whiskybase was useful in many tasks, but Peated must not collect or copy it
automatically. See the
[source access audit](./external-review-source-audit-2026-08.md).

## Common Mistakes

- A current range is not the full catalog.
- One country site is not the worldwide catalog.
- One auction or shop row is not always a separate release.
- Gift boxes, bottle sizes, wax colors, and label changes often use the same
  whisky.
- Labels can be more accurate than page text.
- Auction, shop, image, approval, distillation, and bottling dates are not
  release dates.
- Private picks and single casks often have no complete public list.
- An exact image may still lack permission for Peated to store it.
- A direct image URL does not record its source or license.

## Keep After The Task

- Catalog and exact evidence links
- Years, markets, ranges, and exclusions checked
- Conflicts and page errors found
- Searches tried for missing releases
- Image source and stated license
- A small Bottle-to-source list when it will be reused

Do not keep raw API replies, downloaded images, tokens, or request files unless
they have lasting value. The
[Whisky Auctioneer audit](../operations/catalog-audits/2026-09-02-whisky-auctioneer/README.md)
shows how to keep useful links and decisions without raw downloads.
