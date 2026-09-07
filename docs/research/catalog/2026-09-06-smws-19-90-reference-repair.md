# SMWS 19.90 reference repair — September 6, 2026

This narrow production repair covered the conflicting SMWS 19.90 and 19.91
Bottle identities reported by the archive scraper. It was not a full SMWS
catalog audit. Two active Bottles needed no field or image changes, and one
legacy import reference was quarantined. No Bottle was merged or deleted.

- SMWS's exact product pages identify
  [19.90 as Chilled toddy](https://smws.com/chilled-toddy/) and
  [19.91 as Soul warming](https://smws.com/soul-warming/). The producer
  [archive](https://smws.com/archive?limit=60&page=11&whisky_flavour=77) lists
  the releases next to one another with those same codes and titles. These
  sources prove that “SMWS 19.90 Soul warming” mixes the code from one release
  with the subtitle from the other; it is not a historical title for either
  Bottle.
- B38302 remains the active 19.90 Chilled toddy Bottle, and B30107 remains the
  active 19.91 Soul warming Bottle. Retired Bottle ID 29597 still resolves to
  B30107, preserving its redirect and consumer history.
- BottleReference 22362 was detached from B30107 and marked ignored so the
  invalid combined name cannot claim cask 19.90 again. Its stable ID and audit
  history were retained. Reference 3609 remains assigned to B38302, while
  references 22368 and 11629 remain assigned to B30107.
- Final production searches returned exactly one Bottle for each Society code:
  B38302 for 19.90 and B30107 for 19.91. The invalid exact name had no matching
  price or external-review records, and neither Bottle had member reviews or
  tastings that needed inspection for reassignment.
