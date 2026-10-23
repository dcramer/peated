# Bottle naming repair

Date: 2026-10-22

## Scope

This pass brought stored Bottle names, editions, and cask numbers in line with
"Bottle Name, Edition, And Cask Number" in the
[Whisky Identity Model](../../architecture/whisky-identity-model.md#bottle-name-edition-and-cask-number).
It covered every production Bottle. The whole catalog was read one page at a
time on October 22 (see the pacing note in
[Catalog Research](../../operations/catalog-research.md)). The owner approved
the write set after a 52-Bottle pilot.

It repaired four kinds of records:

- A Bottle named for its distillery with a stored vintage but a bare name, such
  as Rare Malts Selection `Clynelish`, became `Distillery Vintage`.
- A `Distillery Vintage Age` name kept its age only when the same Brand has
  another Bottle of that distillery and vintage.
- An edition that held a cask number lost it; other words stayed in the
  edition.
- Bottle 47586 got back its name, which an earlier pass had stripped.

The [Glen Ord record](./2026-10-19-glen-ord.md) describes the October 19 pass
that stripped many of these names.

## Evidence Used

- **Earlier names in the change history.** `GET /v1/changes?type=bottle` keeps
  the name each Bottle had before the October 19 Glen Ord pass, the October 20
  Rare Malts Clynelish rename, and the October 22 morning pass that cut many
  independent bottlings to a bare distillery name. Those names came from label
  text and were the first choice.
- **Bottler convention.** The owner accepted a stored `vintageYear` as proof
  that the label prints the vintage when an independent bottler or an owner's
  collection released the Bottle. Gordon & MacPhail, Signatory, Cadenhead,
  Single Cask Nation, Rare Malts Selection, Special Releases, and similar labels
  print a distilled year. The rule does not apply when the distillery's own line
  is the Brand: those Bottles were left for review.
- **Same-vintage siblings.** Each check covered the whole catalog: same Brand,
  a shared distiller, and the same `vintageYear`. Series was ignored, so
  Connoisseurs Choice and Private Collection Bottles of one G&M distillery and
  vintage count as siblings.
- **Distillery names.** The name must start with one of the Bottle's distiller
  names or a known other name for that distillery's make: Ledaig, Inchmurrin,
  Inchfad, Croftengea, Old Rhosdhu, Linlithgow, Mosstowie, Glencraig,
  Craigduff, Glenisla, Braes of Glenlivet, Arran, Longrow, pre-1969 Clynelish
  (Brora), M&H, or Finglassie. Expression and region names keep their printed
  wording; examples are Wemyss `Spiced Figs 1990`, North Star `Tarot 2010`, and
  A.D. Rattray `Orkney 2002 15-year-old`.

## Bottle 47586, Gordon & MacPhail The Dram Takers BenRiach 1966

- [Whiskyfun, "Some Benriach at random" (2026)](https://www.whiskyfun.com/2026/Some-Benriach-at-random.html)
  gives the label facts: 55 years, distilled 1966, bottled 2021, 51.2%, The
  Dram Takers, refill American hogshead, cask #607, 52 bottles.
- [Hedonism](https://hedonism.co.uk/product/benriach-55-year-old-dram-takers-gordon-and-macphail-1966-whisky)
  confirms 55 years, 1966, 51.2%, a hogshead, and 52 bottles. It gives no cask
  number.
- Conflict: the stored cask type is "First-Fill American Hogshead", while
  Whiskyfun says "refill". No label photo settles it, so the stored value
  stayed.
- Whiskybase lists a different Dram Takers BenRiach 1966: cask 606, 50 years,
  bottled 2016 for La Maison du Whisky's 60th anniversary. Peated has no
  Bottle for it. It is a lead only, because Whiskybase cannot be fetched or
  copied; a label or an exact auction lot is needed before creating it.

## Left Unchanged, With The Open Question

- **Same-vintage siblings with no stored age.** Their names stay
  `Distillery Vintage`, while siblings with a known age show it. Which age
  does each label print? Bottling year minus vintage is not a stated age.
- **Official distillery-Brand Bottles** with a bare or vintage name, such as
  Hakushu, Yamazaki, and Kilchoman. Does the producer's title print the
  vintage?
- **Renames inside a shared BottleGroup.** One example is the Special Releases
  Caol Ila 1978 and 1979 Bottles, which share the name `Caol Ila`. A rename
  would change every member, and Peated has no group split.
- **Names whose year is not the vintage**, such as `Fèis Ìle 2005`,
  `Year of the Horse 2026`, and a Lady of the Glen `Ardmore 2013` stored with a
  2010 vintage. Which year does the label print?
- **Expression and region names** with a vintage and age, as listed above.
- **Editions that hold a number but are not a cask**: G&M `#1`, `#2`, and `#3`
  on closed-distillery releases, Dramfool `1.1`, G&M batch codes such as
  `18/012`, and release years. Editions where the cask word belongs to a
  marketed name, such as Cardhu `Select Cask 9001`, Clynelish
  `The Hogmanay Cask 16802`, and Golden Moon `Veterans Cask #2`, also stayed.
  Is the number printed as a cask number?
- **Named releases in `edition`**, such as `4th Release`, `Chapter …`,
  `Nth Edition`, and `YYYY Release`. The rule moves a release name people use
  as the title into `name`, but the owner has not settled where ordinal
  editions and release years belong. Examples are Kilchoman 100% Islay
  `10th Edition`, Heaven Hill Select Stock, Macallan Sherry Oak `2023 Release`,
  and Pappy Van Winkle, whose label prints no year. This pass did not move any.
- **Benromach (Brand E128)** was left to the Benromach catalog sessions
  running the same day.
