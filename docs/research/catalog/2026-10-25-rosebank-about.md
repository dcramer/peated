# Rosebank About example — October 25, 2026

This file supports the distillery example in
`apps/server/src/lib/entityAbout/examples/rosebank.ts`, the first style
example in the About writer's prompt. It replaced Brora, so Brora and
Clynelish can be model-check cases. Rosebank is E1296 in Peated, a
distillery. No production records were changed.

## Where the facts live

- Rosebank's own site is the owner's account. It renders with JavaScript, so
  its text was read from the site's content service. [Our Story](https://www.rosebank.com/our-story)
  has the 1840 founding, the 1993 closing, the 2008 still theft, Ian Macleod
  Distillers in 2017, and new spirit on 5 June 2023.
  [Rosebank Beginnings](https://www.rosebank.com/our-beginnings) has the
  Camelon maltings and a rebuild in 1868.
  [First Iconic Moments](https://www.rosebank.com/our-journal/rosebank-first-iconic-moments)
  has the 5 June 2023 restart and the stills copied from archive blueprints.
- Historic Environment Scotland's [listing LB44184](https://portal.historicenvironment.scot/designation/LB44184)
  has the circa 1840 conversion of the Camelon maltings, the 1864-6 rebuild,
  Rosebank Distillery Ltd in 1894, Scottish Malt Distillers in 1914, the
  three stills from 1962 lost to theft circa 2008, and the Category B listing
  on 25 April 1997.
- Wikipedia's [Rosebank distillery](https://en.wikipedia.org/wiki/Rosebank_distillery)
  has the Distillers Company in 1925, the October 2017 purchase, and "three
  decades" of silence. Its text is CC BY-SA, so the example quotes it briefly.
- Whiskypedia's [Rosebank](https://scotchwhisky.com/whiskypedia/2076/rosebank/)
  has a timeline and an owners list, including United Distillers from 1986
  and Diageo from 1997.
- Whisky Advocate gives the closing day, 30 June 1993, in
  [its 2023 restart story](https://whiskyadvocate.com/Rosebank-Restarts-Production-After-Three-Decades-of-Silence),
  and the 2002 sale to British Waterways in
  [its 2017 story](https://whiskyadvocate.com/rosebank-distillery-will-reopen).

## Traps

- The rebuild: Historic Environment Scotland and Wikipedia say 1864; Rosebank's
  own Beginnings page says 1868. The example stores 1864, which more
  independent sites state, and keeps the 1868 citation, so the page shows
  "Sources disagree".
- The restart: Rosebank says new spirit flowed on 5 June 2023; Wikipedia says
  July 2023. Whisky Advocate's 18 July date is the first cask filled, not the
  first spirit. The example stores the official date and keeps the Wikipedia
  citation.
- The founding: Wikipedia's infobox says 1798 and the Stark brothers, which is
  an earlier distillery at Laurieston. Historic Environment Scotland says the
  distillery was founded as Camelon in 1817 by James Robertson; Wikipedia and
  Whiskypedia say a short-lived distillery called Rosebank opened in 1817, and
  that Camelon opened in 1827 (Whiskypedia's Camelon page says 1826).
  Rosebank's own site says it began in 1840. The example stores only 1840 and
  no earlier name.
- Rosebank has no rename of its own, so the example has no `renamed` event.
- James Rankine is a "local wine merchant" on one Rosebank page and "a
  licensed grocer and tea-blender" on another. The example does not say which.
- The 1993 owner is Diageo (Historic Environment Scotland), DCL (Wikipedia,
  and a Rosebank journal post), United Distillers (Whisky Advocate), or UDV
  (Whiskypedia).
  Diageo did not exist until 1997. The example does not name the owner that
  closed it, and leaves out the reason, since Rosebank blames a glut of blended
  whisky and the others an upgrade cost.
- Visitor opening dates disagree (Wikipedia gives both 7 June 2024 and July 2024) and are visitor details, so the example leaves them out.

## Unknowns

- The water source and still layout of the new distillery. Historic
  Environment Scotland's Carron Valley Reservoir and one wash and two spirit
  stills describe the old plant; Wikipedia's infobox gives two wash stills and
  one spirit still.
- The new distillery's capacity in litres of alcohol.
