# Scraper Source Inventory

This inventory records the production scraper entry points migrated to the
governed runtime. Origins are exact runtime allowlists. Baselines come from the
existing deterministic parser fixtures; they are regression signals, not an
estimate of current live inventory.

| Source             | Exact origin                               | Request and continuation shape                                             | Fixture baseline                                                    |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Astor Wines        | `https://www.astorwines.com`               | GET HTML, two paginated categories                                         | 12 items on listing fixture; manual-only                            |
| Berry Bros. & Rudd | `https://www.bbr.com`                      | GET HTML pages                                                             | 3 items                                                             |
| Bruichladdich      | `https://www.bruichladdich.com`            | GET JSON pages                                                             | 4 items; runtime integration persists 4                             |
| Cadenhead's        | `https://www.cadenhead.shop`               | GET WooCommerce JSON pages                                                 | 2 items                                                             |
| Compass Box        | `https://www.compassboxwhisky.com`         | One GET HTML collection                                                    | 2 items                                                             |
| Decadent Drinks    | `https://decadent-drinks.com`              | GET HTML pages, zero-based remote page                                     | 1 supported item                                                    |
| Douglas Laing      | `https://www.douglaslaing.com`             | GET Shopify JSON pages                                                     | 4 items                                                             |
| Dramfool           | `https://dramfool.com`                     | GET catalog pages                                                          | 2 items                                                             |
| Edradour           | `https://www.edradour.com`                 | GET listing pages plus product-detail fan-out                              | 2 items                                                             |
| Fine Drams         | `https://www.finedrams.com`                | GET HTML pages                                                             | 4 items                                                             |
| GlenAllachie       | `https://shop.theglenallachie.com`         | GET catalog pages                                                          | 4 items                                                             |
| Gordon & MacPhail  | `https://shop.gordonandmacphail.com`       | GET Shopify JSON pages                                                     | 2 items                                                             |
| Healthy Spirits    | `https://us-vir5-storefront-api.ecwid.com` | Read-only POST JSON catalog pages                                          | 3 items                                                             |
| Kilchoman          | `https://www.kilchomandistillery.com`      | One GET HTML shop page                                                     | 2 items                                                             |
| Master of Malt     | `https://ll7rrres19-dsn.algolia.net`       | Read-only POST Algolia pages with code-owned headers                       | 9 items                                                             |
| Mission Liquor     | `https://www.missionliquor.com`            | GET catalog pages                                                          | 5 items                                                             |
| Nc'nean            | `https://ncnean.com`                       | GET catalog pages                                                          | 3 items                                                             |
| North Star Spirits | `https://northstarspirits.com`             | GET Shopify JSON pages                                                     | 2 items                                                             |
| ReserveBar         | `https://api.liquidcommerce.cloud`         | POST token query then read-only POST catalog pages with code-owned headers | 2 items                                                             |
| Single Cask Nation | `https://singlecasknation.com`             | GET Shopify JSON pages                                                     | 6 items                                                             |
| SMWS               | `https://api.smws.com`                     | One GET JSON catalog partition                                             | 127 emitted bottles from 128 records                                |
| SMWSA              | `https://newmake.smwsa.com`                | One GET HTML collection                                                    | 35 bottles                                                          |
| Thompson Bros.     | `https://www.thompsonbrosdistillers.com`   | GET WooCommerce JSON pages                                                 | 2 items                                                             |
| Total Wine         | `https://www.totalwine.com`                | GET HTML, two paginated categories                                         | 112 items on listing fixture; target disabled pending policy review |
| Whisky Advocate    | `https://whiskyadvocate.com`               | Manual-only GET of the issue index, newest issue, and listed review pages  | 106 issues and 166 reviews in parser fixtures                       |
| Whiskyfun          | `https://www.whiskyfun.com`                | Daily GET of RSS plus up to 20 current article pages                       | 2 accepted feed items and 2 article reviews in parser fixtures      |
| The Whisky World   | `https://www.thewhiskyworld.com`           | GET HTML pages                                                             | 5 items                                                             |
| Wooden Cork        | `https://woodencork.com`                   | GET cursor-style collection pages                                          | 38 items                                                            |

## Entry-point audit

All scheduled and manual external-site runs now dispatch only `RunScraper` with
a durable run id. Retailer GETs use the runtime-backed legacy request bridge;
Healthy Spirits, Master of Malt, and ReserveBar use its governed POST support.
SMWS and SMWSA emit bottle observations through runtime sinks. Whisky Advocate
and Whiskyfun use the shared external-review sink. The runtime enforces robots
rules before remote requests.

The previous response-body disk cache is removed. Production use of the legacy
request helper without an active runtime session fails before network access;
its Axios fallback exists only under the test environment for the existing
parser fixtures. A repository test rejects raw HTTP clients, global `fetch`,
queues, database clients, and product-persistence imports from runtime adapter
modules.
