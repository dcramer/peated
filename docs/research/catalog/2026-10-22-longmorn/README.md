# Longmorn catalog backfill

Production backfill and evidence audit requested on 22 October 2026, covering
Longmorn official releases, independent bottlings, historical Longmorn-Glenlivet
labels, and discontinued releases.

## Verified results

- Created **354 Bottles**.
- Corrected **77 of the 142 original records**, retaining their IDs. There were
  83 verified update operations across 78 IDs, including a later correction to
  one newly created Bottle.
- Created **16 Entities and 22 Series** and added **two public Bottle aliases**.
- Checked all **285 historical leads** and **46 additional archive leads**.
- Retained existing images, references, user history and duplicate candidates.
  No merges, deletions, or image uploads were performed.

The final paginated inventory contains **499 unique records**: 490 found by the
Longmorn distiller relationship, 43 by the Longmorn brand relationship, and 499 by
name search, with overlap. This total includes the 142 original records, 354
records created in this task, and three records added by other catalog work
during the session. One search hit, Bottle 59070, is Tullibardine matured in an
ex-Longmorn cask and is outside this scope. The other work's Bottles 67941, 67945
and 67958 are excluded from this task's creation count.

Every write was fetched again with its edit context, aliases and import
references. All written groups were verified as singletons. The final inventory
matched the saved names, ages, years, strengths, casks, outturns, maturation and
editions for every changed Bottle. The 22 new Series counts also matched their
Bottle-list totals. No code was changed; verification used production API reads.

## Evidence and coverage

- [Verified production changes](changes.md): each write and its evidence.
- [Original record audit](original-records.md): 77 updated, 56 retained with no
  Bottle change, eight unresolved sparse records, and one out-of-scope record.
- [Historical release work list](historical-worklist.md): all 285 leads have an
  outcome; six remain unresolved and one was a research cask sample.
- [Additional archive releases](additional-releases.md): 27 creates, one update,
  four already-covered releases, and 14 unresolved leads.
- [Related records](related-records.md): Entities, Series, aliases, verified
  counts and the outstanding Entity website issue.
- [Images and references](images-and-references.md): per-record coverage.

The independent inventory used the [Longmorn collection](https://www.longmorn.com/en/the-collection/),
[Chivas Brothers announcements](https://www.chivasbrothers.com/2024/11/longmorn-introduces-its-ultimate-expression-and-oldest-single-malt-to-date/),
the [Gordon & MacPhail archive](https://www.gordonandmacphail.com/our-whiskies/distilleries/longmorn),
producer release pages, readable labels, and exact auction and retailer records.
The [Whiskyfun Longmorn index](https://www.whiskyfun.com/Longmorn.html) supplied the
historical cross-check. Coverage includes UK, continental European, US, and
Japanese releases. These sources do not establish every private cask ever bottled.

Search results and review indexes were leads, not automatic authority for exact
facts. Whiskybase pages were not collected automatically. Review prose and
scores were not imported. Bottle size, packaging, approximate dates and auction
dates were not used by themselves to create distinct releases. Stated ages were
not calculated by subtracting years.

## Remaining uncertainty

The unresolved rows identify the missing evidence and retain broad existing
identities where a specific release cannot be proved. Material examples include:

- Bottles 61328 and 62524 may both be G&M 1966/2019 Private Collection cask 610.
  They remain separate; no merge was performed.
- Generic official 15- and 23-year records cannot safely be assigned to one of
  the separately documented launches or strengths.
- SMWS 7.286 has conflicting UK and US age/strength listings. The established UK
  identity remains unchanged by the conflicting US claims.
- Watashi's Lust page describes 60.8%/120 bottles but illustrates 57.2%/72 bottles.
  The text variant is retained; a separate illustrated variant is unresolved.
- A purported Spirit of Scotland 1966 review shows a 1962 label. The conflict
  does not establish a new 1966 release.
- The Whisky Experience Entity's unrelated visitor-attraction website is
  repopulated after an attempted clearance. That website correction did not
  persist and is not reported as verified.

The final inventory has 87 pre-existing images. Their availability does not
establish image reuse permission. Missing source/licence metadata remains
unverified; no new image was uploaded without established rights.
