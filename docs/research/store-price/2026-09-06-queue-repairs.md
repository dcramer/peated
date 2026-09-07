# Store-price queue repairs — September 6, 2026

This production pass resolved the eight remaining SMWS `match_existing`
proposals and the four `correction` proposals. It repaired five Bottle categories
from blended Scotch to blended malt, retried the four affected listings, and
approved all twelve exact matches. The final queue counts for both
`match_existing` and `correction` were zero. No Bottle was merged or deleted.

- The saved images on the eight SMWS candidate Bottles were inspected directly.
  Each label showed the exact cask code and marketed name from its listing,
  including 149.27, 168.4, 95.117, 78.102, 79.17, 64.173, 36.237, and 8.58.
  The classifier's recorded image-conflict rationales were false positives, so
  the images were retained and the listings were matched to those exact Bottles.
- Douglas Laing's exact producer pages for
  [The Epicurean](https://www.douglaslaing.com/products/the-epicurean),
  [The Founding Fathers Reserve](https://www.douglaslaing.com/products/rangers-the-founding-fathers-reserve),
  [Timorous Beastie 10 Years Old](https://www.douglaslaing.com/en-us/products/timorous-beastie-10-years-old),
  and
  [Timorous Beastie x West Brewery](https://www.douglaslaing.com/products/timorous-beastie-x-west-brewery)
  established regional-malt compositions and the stored strengths. The Founding
  Fathers page explicitly identifies a blended malt, while The Epicurean and
  Timorous Beastie pages describe marriages of regional malts. B45374, B45356,
  B45381, B14154, and B47221 were therefore corrected to `blended_malt`.
- Timorous Beastie 10-year-old has separate Small Batch #1 and #2 releases.
  The exact [Batch 1 retailer record](https://www.thewhiskyexchange.com/p/39858/timorous-beastie-10-year-old-batch-1)
  and [Small Batch #1 auction record](https://whiskyauctioneer.com/learn/explore-whisky/bottles/timorous-beastie-10-year-old-small-batch-1)
  support the first identity. B47221's stored label visibly says “10” and
  “Small Batch #2”; the queue listing used that same image, so it was assigned
  to B47221 rather than B14154. B14154 remains the supported Small Batch #1
  identity. Its stored image showed the standard no-age Timorous Beastie and was
  removed after explicit deletion approval. No replacement was uploaded because
  the exact Batch #1 sources did not state reusable image rights.
