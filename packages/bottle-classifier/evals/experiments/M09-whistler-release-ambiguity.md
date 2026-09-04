# M09: require review for the ambiguous Whistler Bodega Cask source

**Accepted as a measurement correction.** The name-only Whistler Bodega Cask
test case now expects review instead of a created Bottle.

The fixture supplies `The Whistler Bodega Cask Single Malt Irish Whiskey`
without a source URL, label, or ABV. The current producer page identifies a
5-year-old Bodega Cask Single Malt at 86 proof. A 2021 exact-product review
identifies the same marketed name at 92 proof / 46% ABV. The available evidence
does not establish whether these are market versions, a product change, or an
error. It also does not identify which one the name-only input observed.

Creating a Bottle with either ABV would add an unsupported exact fact. The safe
result is `no_match` until the source provides a release-specific label, URL, or
ABV. The test case now uses `block_if_uncertain` and `review_required`.

This correction changes the saved September 3 Luna-high result from 80/105 to
79/105 because that run created the 43% product. It changes the C26 Variant B
result from 78/105 to 79/105 because that run returned `no_match`. The adjusted
runs are equal at 79/105, although they still cannot measure C26 because they
used different source revisions and ran only once.

No classifier code or saved model output changed. The correction made no model
calls.

Sources:

- [The Whistler Bodega Cask producer page](https://thewhistlerwhiskey.com/whiskey/bodega-cask/)
- [The Whiskey Wash review of the 46% release](https://thewhiskeywash.com/irish-whiskey/whiskey-review-the-whistler-bodega-cask-irish-single-malt/)
