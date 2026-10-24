# Member Tastings And Library

A member profile has Tastings and Library tabs. Each tab lists one member's
records, with search, a sort, and a filter rail. `/tastings` sends a signed-in
member to their own Tastings tab.

Code, runtime schemas, and tests own the exact request and response shapes.
Private profiles follow the usual profile rules: the list, stats, and search
routes return nothing a visitor could not already see.

## Shared layout

Both tabs use the same parts:

- A toolbar with the count on this page, the total, and a sort. The Tastings
  total counts the tastings that match the filters; the Library total is the
  member's whole Library.
- A search box that suggests brands, producers, and Bottles from this member's
  records. Picking a brand or producer filters the list. Picking a Bottle opens
  it. Enter without a suggestion searches the Bottle names.
- A filter rail. Each group shows a count and a bar for every choice; clicking
  a choice filters the list, and clicking it again clears it. On phones the
  rail becomes a drawer above the list.

Filters, search text, sort, and page live in the URL, so a filtered view can
be shared and the server renders it on first load.

## Tastings tab

| URL parameter | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| `query`       | Search the tasted Bottle's name                      |
| `entity`      | A brand, bottler, or distillery of the tasted Bottle |
| `distiller`   | A distillery of the tasted Bottle, from the rail     |
| `rating`      | One rating, such as `very_good`                      |
| `age`         | One stated-age range, such as `from13To17`           |
| `country`     | The country of the Bottle's brand                    |
| `region`      | A region of that country; needs `country`            |
| `sort`        | `-created` (newest), `-rating` (best first), `name`  |
| `view`        | `table` for the compact table; the list is default   |

The rail shows Rating, Age, Countries, Regions, and Distilleries. Distilleries
sets `distiller`, which matches only the distillery role its count uses;
`entity` is for a brand or producer picked from search. Age also
shows the median and oldest stated age. Regions appear only after a country is
picked.

Each count must equal what its filter returns:

- Rating and age counts come from the member's tasting stats. The age ranges
  are defined once, in `AGE_BUCKETS`, and both the stats and the filter use
  them.
- Location follows the Bottle's brand, the same rule the member region list
  counts by. The region list returns its 25 largest country and region groups,
  plus a total for every country; the Countries group uses those totals, so
  each matches the country filter. Regions lists that country's rows from the
  25 largest groups.
- Counts are the member's totals. They do not shrink when another filter is
  set.

The list view shows each tasting with its note, tags, and date, without
repeating the member's name. The table shows two lines per tasting: date,
Bottle, ABV, and rating name on the first; the note, cut to one line, on the
second. On phones the table hides the date and ABV columns and puts the date
before the note.

## Library tab

| URL parameter | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| `query`       | Search Library Bottle names                           |
| `entity`      | A brand or producer picked from search                |
| `status`      | `open`, `sealed`, `empty`, or `unset`                 |
| `brand`       | One brand from the rail                               |
| `distiller`   | One distillery from the rail                          |
| `sort`        | `name` (alphabetical, default) or `-created` (newest) |

The rail shows Status, Brands, and Distilleries with counts from the member's
Library stats. The member can change a Bottle's status or remove it from the
row menu.

## Search ranking

Member search covers only that member's Bottles, so it ranks by how well the
name matches, then by name. It does not use the TIN text score: the member
filter lets Postgres pick a plan without the TIN index scan that `tin.score`
needs. See [Bottle Search](../architecture/bottle-search.md).
