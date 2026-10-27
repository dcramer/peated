# Member Tastings And Library

A member profile has Tastings and Library tabs. Each tab lists one member's
records, with search, a sort, and a filter rail. `/tastings` sends a signed-in
member to their own Tastings tab.

Code, runtime schemas, and tests own the exact request and response shapes.
Private profiles follow the usual profile rules: the list, stats, and search
routes return nothing a visitor could not already see.

## Shared layout

Both tabs use the same parts:

- A toolbar with the count on this page, the total that matches the filters, a
  sort, and a list or table view.
- A search box that suggests brands, producers, and Bottles from this member's
  records. Picking a brand or producer filters the list. Picking a Bottle opens
  it. Enter without a suggestion searches the Bottle names. Below 760px a
  Search button beside the field does the same, because the drawer's View
  results button only closes the drawer.
- A filter rail. Each group shows a count and a bar for every choice; clicking
  a choice filters the list, and clicking it again clears it. Below 760px the
  rail is hidden; a Filters button in the toolbar, counting active filters,
  opens a drawer with search, sort, and the same groups. The bottle catalogs
  use the same button and drawer.

While a tab loads, its loading view reserves the toolbar, the rail groups, and
the list or table rows at their finished sizes, so nothing moves when the
results arrive. See [Web Loading](../development/web-loading.md).

Filters, search text, sort, view, and page live in the URL, so a filtered view
can be shared and the server renders it on first load. Both tabs read and set
them through `useProfileListParams` in `profileListFilters.ts`, which also
builds the groups both rails share: Brand or producer, Age, and the ranked
brand and distillery lists.

Each rail count must equal what its filter returns. Counts are the member's
totals; they do not shrink when another filter is set. Age ranges are defined
once, in `AGE_BUCKETS`, and the stats and both tabs' `age` filters use them.

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

Where the counts come from:

- Rating and age counts come from the member's tasting stats.
- Location follows the Bottle's brand, the same rule the member region list
  counts by. The region list returns its 25 largest country and region groups,
  plus a total for every country; the Countries group uses those totals, so
  each matches the country filter. Regions lists that country's rows from the
  25 largest groups.

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
| `age`         | One stated-age range, such as `from13To17`            |
| `brand`       | One brand from the rail                               |
| `distiller`   | One distillery from the rail                          |
| `sort`        | `name` (alphabetical, default) or `-created` (newest) |
| `view`        | `table` for the compact table; the list is default    |

The rail shows Status, Age, Brands, and Distilleries with counts from the
member's Library stats. Age also shows the median and oldest stated age. The
stats count every Library Bottle, empty ones included, because the list shows
them; Brands and Distilleries show the top five. The Library tab's badge and
the profile's "In library" count every Library Bottle the same way.

The list view shows each Bottle with its status. The table shows one Bottle
per row: a compact identity with its producers and release facts on a second
line, the status, and the ABV. On phones the table hides the ABV column. The
member can rate a Bottle, change its status, or remove it from the row menu in
either view; a failed change shows an error message and leaves the row as it
was.

## Search ranking

Member search covers only that member's Bottles, so it ranks by how well the
name matches, then by name. It does not use the TIN text score: the member
filter lets Postgres pick a plan without the TIN index scan that `tin.score`
needs. See [Bottle Search](../architecture/bottle-search.md).
