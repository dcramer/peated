# Production Entity Kind Backfill

Date: 2026-08-27

Target: `https://api.peated.com`

## Kind backfill

The first full API audit found 843 Entities without a kind:

- 426 suggested Distillery;
- 309 suggested Brand;
- 96 suggested Bottler;
- 12 had no legacy type and no active Bottle use.

The audit recorded 1,458 Brand links, 636 Bottler links, and 314 Distiller
links for those 843 Entities. Each automatic change sent only `kind` through
the normal Entity update API. A separate Entity details request verified every
write. The kind-only update path does not change Bottle links.

Another process completed 11 suggested changes before this run started. This
run applied and verified the other 820 suggested changes. The 12 empty-type
rows received reviewed kinds:

| Entity                   | Kind       | Basis                                                                                                     |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| Weidhöfler               | Distillery | The producer's site identifies a specialty distillery and its single malt.                                |
| West of Kentucky         | Brand      | This is a Sonoma County Distilling bourbon label.                                                         |
| Whaligoe                 | Brand      | No separate producer identity was found; keep it as a label identity.                                     |
| Whisky Festival Radebeul | Company    | This is an organizing identity, not a Bottle role. Review it for later catalog cleanup.                   |
| White - Brook            | Brand      | Whiskybase identifies White - Brook as a brand.                                                           |
| White Tiger              | Brand      | The name is ambiguous across several spirits brands.                                                      |
| Wilson's                 | Brand      | The name identifies both a historic distillery and its whisky; use the consumer label for this empty row. |
| Winter Wedding           | Brand      | This is a Langatun product label. Review it for later catalog cleanup.                                    |
| Zippin                   | Brand      | This is a Swedish blended whisky label made by Selected Malts.                                            |
| Clyde Distillers Ltd.    | Company    | The empty company record has no active Distiller use.                                                     |
| Bruce & Company          | Bottler    | Historical releases identify it as a blender and bottler.                                                 |
| Thistle Collection       | Bottler    | Whiskybase identifies it as an independent bottler.                                                       |

The final backfill query returned zero rows. `/stats` then reported 4,656
Entities. The five kind totals also summed to 4,656.

## Owner audit

The generic Entity API returned all 4,656 Entities and 1,874 current owner
links. The audit found:

- zero missing owner targets;
- zero self-owner links;
- zero ownership loops.

## Browse query plans

The Brand, Distillery, and Bottler queries use the same kind predicate and
ordering. The configured development database had 164 rows, so PostgreSQL
correctly chose a sequential scan. The three measured executions took between
0.03 ms and 0.13 ms. The existing `entity_kind_idx` remains available as the
catalog grows. No additional index is justified.
