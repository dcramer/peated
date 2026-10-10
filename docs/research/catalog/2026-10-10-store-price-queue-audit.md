# Store-price queue pass and audit, October 10, 2026

Researched October 10, 2026. This record covers one pass over the store-price
match queue (matches, creates, and ignores decided by hand) and the audit of
that pass the same day. It says which sources settled a listing, which ones
contradicted each other, and what is still unknown, so the next pass does not
repeat the research.

## What settled a listing

- **The listing's own label image.** Each proposal keeps the store's image at
  `price.imageUrl`. It is small. The store's full-size image shows the proof
  line: for a Shopify store, `https://<shop>/products/<handle>.json`, then
  `product.image.src`. Keg N Bottle, Mission Liquor, Wooden Cork, and Douglas
  Laing are Shopify stores.
- **The store page.** The same Shopify JSON gives `body_html`. Keg N Bottle
  pages usually state proof, batch, barrel number, and age. Douglas Laing's
  body text carries no ABV.
- **Master of Malt pages** need a real browser (`agent-browser open`), one page
  every few seconds. The ABV is the first percentage in the page text.
- **A mechanical comparison** of the listing title and the label read against
  the Bottle's live fields (age, years, proof, batch and cask words). It flagged
  56 of 152 matches; most flags were spelling (`No.4` against `No. 4`), and it
  found both matches that did not hold up.

## Conflicts between sources

- **Angel's Envy Cask Strength, "2020" listing at Keg N Bottle.** The title
  says 2020. The label image and the page say 119.8 proof, which is the 2022
  release. The 2020 release was 120.4 proof
  ([Bourbon Banter](https://bourbonbanter.com/angels-envy-limited-edition-2020-cask-strength-bourbon-review),
  [GoBourbon](https://www.gobourbon.com/for-the-first-time-angels-envy-cask-strength-will-hit-shelves-in-all-50-states/)).
  The listing contradicts itself, so it cannot be matched to either release.
- **Amrut "Cask Strength Peated" listing at Keg N Bottle.** The image shows
  the unpeated Cask Strength at 61.8%. The title says Peated, which Peated
  holds at 62.8%. The page states no ABV. Unresolved.
- **Jacob's Pardon Cask Collective Sherry Cask.** The Keg N Bottle image shows
  54.3% (108.6 proof), a pre-release render. The producer's release note gives
  16 years and 48.25% ABV
  ([BevNet](https://bevnet.com/pr/2025/05/30/jacobs-pardon-unveils-cask-collective-16yearold-oloroso-sherry-caskfinished-whiskey),
  [Breaking Bourbon](https://breakingbourbon.com/bourbon-whiskey-press-releases/jacobs-pardon-unveils-cask-collective-16-year-old-oloroso-sherry-cask-finished-whiskey)).
  The producer's values were used. The label prints no age.
- **Indri Founder's Reserve 11-year-old.** The label read gave 51.2%. The
  full-size image shows 58.5% and "102.4 Proof" (UK proof), which is the
  Bottle's value.

## Packaging is not a release

The identity model says a special label, box, or gift pack on the same liquid
is the same Bottle. Two cases looked like new releases and were not:

- **Gold Bar "Lunar New Year Horse".** The box reads "The Original Gold Bar
  Premium Blend", blended whiskey finished in California casks, 80 proof: the
  standard whiskey in a horse-art box.
- **The Tribute Series "Navy 250th Anniversary".** Keg N Bottle's three-bottle
  collection page says the Marines, Navy, and 250th Anniversary editions each
  hold the same 10-year Kentucky straight bourbon with different artwork.

Gold Bar's "America 250" and "49ers" records, and a Tribute Series "Marines"
record if one is created, raise the same question and were not reviewed.

## Wording that is not on the label

- Colonel E.H. Taylor Barrel Proof labels print no batch number. Stores add
  "Batch 13". An older record still carries "Batch 12" as its edition.
- Old Forester The President's Choice labels have a handwritten barrel field;
  store stock images leave it blank, so the barrel number comes from the page.
- High West prints "Act" and "Scene" on A Midwinter Night's Dram. Peated holds
  one Bottle per Act. No source was found that markets a Scene as its own
  release.

## Still unknown

- Whether four new Bottles match their labels: no stored image, or an image
  with no readable text (High Wire Jimmy Red Sherry Cask Finish, World Whiskey
  Society 9-year-old Batch 3, High N' Wicked Aeneas Coffey No. 4, MGP Chapter
  One: Out of the Shadows). Their facts come from the store page.
- The Old Forester 2026 Birthday Bourbon age and proof. Only a store page was
  found.
- Whether Whiskyland Chapter Thirty Eight is Glen Grant at 46% (as stored) or
  "Gone Grant" at 49.9% (Decadent Drinks' page).
