# Store-price repair lane: Bottles the classifier flagged as conflicting

Researched September 25, 2026. This record covers the Bottles that the
store-price match queue left open as "same product, but a populated field on
the Bottle conflicts with the label": 184 proposals on 162 Bottles, spread
across many brands rather than one scope. It explains which sources settled
each kind of conflict so the next queue pass does not repeat the research.

## What the stored label images proved

- Each flagged Bottle keeps the retailer label image it was created from at
  `imageUrl`. Reading that image settled most conflicts: in more than four of
  five cases the printed ABV or age matched the stored value and the
  classifier's "label evidence" was wrong. Treat a packet's label claim as a
  lead, never as evidence; read the image.
- The stored thumbnails are small. When digits were unreadable, the Shopify
  product JSON of the source shop gave a full-size image
  (`https://<shop>/products/<handle>.json`, then `images[0].src` with a
  `_1200x` suffix). Single Cask Nation's labels became readable this way.
- Real errors found by the images: Barrell Gray Label 15 (105.1 proof),
  Bardstown Collaborative Series Plantation Rum (110 proof), Aberfeldy 21
  (stored 19), Fuji Gotemba Single Malt (92 proof), White Heather 15 (40%),
  Kentucky Owl The Wiseman and Benchmark Hand Picked Single Barrel (no printed
  age), Southern Star Paragon Wheated (92 proof, not the Bottled-in-Bond
  release), and three Single Cask Nation casks whose ABV had been typed wrong.

## Producer and retail sources used

- [Old Forester's 1924 launch note](https://www.oldforester.com/old-forester-debuts-1924/):
  permanent Whiskey Row expression launched January 2024, 100 proof, 10 years.
- [Loch Lomond Original](https://us.lochlomondwhiskies.com/products/original-single-malt-scotch):
  no age statement, 40%.
- [Master of Malt](https://www.masterofmalt.com/) and
  [The Whisky Exchange](https://www.thewhiskyexchange.com/): Fettercairn
  Vanguard Rare 29 (48.3%, 99 bottles) versus Vanguard 1st Release (NAS,
  46.3%); Black Art 11.1 distilled 1998; Dalmore 17 at 42%; Speyburn 18
  Anniversary Edition as the ongoing 18 at 46%; Edradour 10 Distillery Edition
  as the standard 10; Ballantine's Miltonduff 15 Series No. 002 at 40%.
- [Four Roses](https://www.fourrosesbourbon.com/bourbon/single-barrel): Single
  Barrel and the yellow-label Bourbon carry no age statement (100 and 80 proof).
- [Wolfburn](https://wolfburn.com/products/aurora-46-vol-70cl): Aurora is NAS
  at 46%.
- [Old Elk](https://thewhiskeywash.com/reviews/whiskey-reviews-old-elk-distillery/):
  Wheated Bourbon is a 5-year-old at 92 proof.
- [Compass Box](https://www.compassboxwhisky.com/): category wording per
  product page. Celestial is labelled Blended Scotch Whisky, not blended malt;
  Hedonism and Experimental Grain are blended grain.
- [Southern Distilling Company](https://www.southerndistillingcompany.com/our-spirits/paragon-bottled-in-bond-wheated-bourbon/):
  Paragon Bottled-in-Bond Wheated is 100 proof, distinct from the 92-proof
  Paragon Wheated.
- [BevNET](https://bevnet.com/pr/2025/05/21/jeffersons-bourbon-celebrates-the-launch-of-jeffersons-blend-of-straight-rye-whiskey):
  Jefferson's Blend of Straight Rye Whiskeys launched May 2025 at 88 proof.
- [Maison du Whisky](https://www.whisky.fr/en/aberlour-a-bunadh-batch-82.html):
  A'bunadh Batch 82 at 61.2%.
- [Whisky Auctioneer](https://whiskyauctioneer.com/learn/explore-whisky/bottles/chivas-regal-1999-ultis-20-year-old-1-litre-victory-edition):
  Ultis 1999 Victory Edition is a Manchester United release, separate from
  Ultis XX (20-year-old, 40%, includes Strathclyde grain, so a blend).
- [Malts.com](https://www.malts.com/en-us/products/oban-aged-15-years-port-cask-finish-single-malt-scotch-whisky-750ml):
  Oban 15 Port Cask Finish at 52.1% (2026).
- [Tomatin](https://tomatin.com/shop/core-range/12-year-old/): the 12-year-old
  is now titled Triple Cask at 43%; the earlier "Bourbon & Sherry Casks" label
  is the same expression.

## Shop pages that settle a generic listing

- Mission Liquor and Wooden Cork are Shopify shops: `/products/<handle>.json`
  returns the title, description, tags and images without a browser. Their
  descriptions often name the batch, proof, barrel number, fill date or
  selector (Nulu Batch M12, Knob Creek "6th Floor God", WhistlePig barrels
  #19139 and #95631, Eagle Rare barrel #251), which is enough to create the
  store pick with the program name as `edition`.
- ReserveBar product pages work with the exact stored URL only (guessed
  GROUPING ids return 404) and state ABV plus the shop's barrel code (S2B13 =
  series 2, barrel 13). They never state age, selector or release date.
- The Whisky World pages give ABV and size only, never a batch or year.
  Master of Malt returns 429 to automated fetches; pace to one request per
  minute or read it in a browser.
- Producer pages used for these creates:
  [Angel's Envy 10 Cask Strength](https://www.angelsenvy.com/us/en/product/angels-envy-10-cask-strength/)
  (122.6 proof, 14th Edition, 2025),
  [Four Roses Single Barrel OESO](https://www.fourrosesbourbon.com/bourbon/single-barrel-oeso)
  (2025 Single Barrel Collection with OBSF and OESK),
  [Dad's Hat Classic Rye](https://dadshatrye.com/whiskey/classic-rye/) (the
  six-month quarter-cask rye, so the same expression as the old Pennsylvania
  Rye record), [Bardstown Origin Series](https://www.businesswire.com/news/home/20221205005129/en/Bardstown-Bourbon-Co.-Announces-The-Origin-Series)
  (6 years, 96 proof), [The Glenrothes 32](https://www.theglenrothes.com/en/the-32)
  (43%, core collection 2024, distinct from the 1972 vintage 32-year-old).

## Creating independent-bottler releases from shop pages

- The Whisky World's details table names the distillery, bottler, ABV, age
  and vintage for almost every independent bottling, which is enough to
  create the Bottle under the identity model: the label brand as Brand when
  Peated has an entity for it (Cask Masters, Old Particular, XOP, Provenance,
  The Single Malts of Scotland, The Kinship, Ronnie's Reserve, Whiskyland,
  Decadent Drams), otherwise the bottler entity as Brand; the distillery as
  the name prefix and distiller; range wording such as Octave Premium, The
  Octave, Dimensions, Dalgety, Monologue, Warehouse No.1, Mythical Beasts or
  Reserve Casks Parcel No.N in `edition` because those ranges have no Series
  record yet. Cask numbers are rarely printed on the shop page; the release
  is still identified by distillery, vintage, age, ABV and bottler.
- Fine Drams pages state ABV and, for Signatory and Ultimate casks, the
  cask number and outturn in the description.
- Plain HTTP with a Chrome user agent works for The Whisky World, ReserveBar,
  Fine Drams and Healthy Spirits. Total Wine and Astor return 403. Master of
  Malt returns 429 to every automated fetch.
- Brands that exist only on ReserveBar (Exclave, Boone's Bourbon, River
  Basin, Rimfire, Fort Mose, Majesty, Unbendt, Wing Woman Reserve, Accord
  Stone, Something Southern, Rare Stash, Swift Distillery, The Craft Irish
  Whiskey Co.) were added as entities with their country only; ReserveBar
  gives no producer facts beyond name and ABV.

## Conflicts settled and how

- Bottler set to the distillery or brand owner on an official release
  (GlenAllachie, Four Roses, Blanton's, Wild Turkey, Red Spot, Deveron, Old
  Pulteney and about ninety others): cleared under the identity model's
  bottler rule. Independent-bottler brands (Compass Box, Single Cask Nation,
  Douglas Laing, Thompson Bros, North Star) keep the self-reference.
- Brand stored as a label word or the wrong company: Michel Couvreur (was
  "Special Vatting"), Speyburn Bradan Orach (was SPEY), Ballantine's
  Miltonduff 15 (was Miltonduff), Old Mull Ledaig (was Decadent Drinks),
  Infrequent Flyers Glen Elgin (was Alistair Walker Whisky Company).
- Category from the label: blended malts stored as blend, Bernheim as wheat,
  Willett Family Estate Small Batch as bourbon, Pendleton 1910 as rye, Shibui
  18 as single grain, Tullamore D.E.W. 14 as single malt.
- Any Bottle PATCH re-materializes a legacy "- 46.0% ABV - Other Cask" name
  into shared name plus edition, dropping printed age wording. Restore the
  age in `name` in the same pass when the label prints it.

## Still unknown

- Gordon & MacPhail Glenlochy 1979 43-year-old (cask 3309, 53.6%) is listed
  under both the Private Collection Recollection Series and the Connoisseurs
  Choice Heritage Collection Volume One; which series the catalog record
  represents is unproven.
- Little Decadent Star (Campbeltown Malts Festival 2026, 53%): the producer
  page prints no age; the stored 8-year-old needs a label.
- Bladnoch Belted Galloway 13 at 55%: the producer's 13-year-old is 46.7%;
  a cask-strength label variant was not found.
- Glenlivet Single Cask Edition 14 and 15 (Creag an Innean, Auchbreck): the
  catalog records carry no cask name and the images are unreadable.
- Michter's US\*1 Sour Mash fits no catalog category (neither bourbon nor rye).
- Glenmorangie's "The Select Release" series should read "Barrel Select
  Release"; there is no series update route.
- Generic listings against annual or batched releases (Ardnamurchan AD/ Cask
  Strength, Glasgow 1770 finishes, GlenAllachie 21 Cask Strength, Wolfburn
  holiday releases, Caol Ila Distillery Exclusive, Benromach Organic 2010,
  Quinta Ruban 12 editions) stay unmatched until the shop page names a release.

## Create lane (create_new proposals), September 25, 2026

All 4,196 `create_new` proposals that were pending on September 25 were
decided. The per-proposal decisions are in Peated's moderation history for
each proposal and in the pull request that added this section. Totals: 1,514 Bottles created (ids 61870 to
63400), 827 matched to existing Bottles, 15 ignored (moonshine, grain
neutral spirit, bundles), 1,840 left open. About 120 ABV repairs were
applied to existing Bottles where a producer, label or shop fact proved the
value (for example Sagamore Signature Rye 62705 to 41.5%, Knob Creek 9 to
50%, Cardhu Gold Reserve GoT to 40%).

Why rows stayed open, by count: no ABV or producer fact on the page (847);
Master of Malt, Total Wine and Astor block fetches and the saved packet has
no ABV (717); an annual, batch or barrel family with no batch named (77);
a brand with no entity (63); page 404 (35); ABV or identity conflicts
between the page and the record (34). Brands still missing an entity:
McLay's, Pelter, Thinkers, Ellis & Angel, Villa N°16, Three Scottish
Brothers, Amaethon, Bache Gabrielsen, Jurassic, Hye-Land, Takamine,
Furthur, Old Fourth, Great Jones, Art of the Spirits, End of Days, Stolen,
The Walking Dead, Fincasa, Den of Thieves, MurLarkey, Du Nord, Mercer +
Prince, Death's Door, Casa Maestri, Warfield, Garage Oil, Five Trail,
Kentucky Walker, Buffalo Chip, Good Distillations, Brough Brothers, Blue Ash
Farm, New Louisville Barrel House, Wind & Wave, Black Stag.

Series-consistent ABVs were used where the page gave none but every release
in the series carries the same strength: Pappy Van Winkle 15/20/23 (107,
90.4 and 95.6 proof), Widow Jane Decadence (45.5%), Midleton Very Rare (40%),
Shenk's Homestead (45.6%), Kilchoman Loch Gorm (46%), Elixir Reserve Casks
(48%). Retailer ABVs were accepted within 0.5 points of the record
(ReserveBar rounds to whole numbers).

Catalog cleanup seen in this lane (not done, needs approval):

- Likely duplicates: 62821 / 58223 (SMoS Ledaig 2005 18, Cask 80); 61973 /
  58079 (Dalmore Select Edition 2009 15); 61981 / 58087 (Dalmore Select
  Edition 2006 18); 62252 / 58228 (Compass Box Flaming Heart 25th); 61644 /
  45307 (Ardbeg Dolce); 57915 / 49877 (Lagavulin Grain & Embers); 2824 vs
  the new Glenfiddich Winter Storm batch records; Old Pulteney 2190 vs casks
  19/20; Arran Illicit Stills 3666 / 16106; Dailuaine Marbled Treasures
  49876 / 57919.
- Wrong or broken records: 14061 "Liber y Pole Peated Bourbon" (name and
  brand 1136); 57092 "Black Butte Whiskey Whiskey"; 62705 had 46.5% from a
  Whisky World listing that was wrong (now 41.5%); 55914 Glenmorangie
  Original stores the 43% US bottling while ReserveBar lists 40%.
- Two Elijah Craig Barrel Proof "Wooden Cork Barrel Select #2" records
  (62976 at 62.7%, 62977 at 62.4%) exist because the shop sold two barrels
  under the same pick name; keep both until the shop clarifies.
- The Rare Cask Reserves range now has a brand entity (367138); the William
  Grant & Sons company entity 5821 still has no Bottles.

## Keg N Bottle lane (fresh proposals), September 25, 2026

Environment: `https://api.peated.com` as @dcramer. Filter: the 568 Keg N
Bottle (site 26889) proposals that arrived after the create lane
(498 no_match, 49 match_existing, 21 create_new), decided from the saved
packet plus the shop's Shopify product JSON, which was fetched for every row.

Result: 314 matches, 145 ignores, 30 creates (63408–63437), 84 Bottle
repairs, 79 left open. Two brand entities were added: Hinotori 367161 and
Jackwagon 367162. Bottle repairs were ABV, category or stated-age fields
that the shop page or the producer proved for the matched record (for
example Blanton's and Benchmark Full Proof lose an invented age; Taketsuru
21 becomes blended malt at 43%; Bladnoch Vinaya loses a 12-year age).

Ignores were flavored whiskies, moonshine, liqueurs and bottled cocktails
(111 found by title words, then each packet read; FEW x Smashing Pumpkins
was pulled back out of that set), plus a few generic titles with no safe
Bottle.

Open rows, by reason: single-barrel or batch families where the page names
no barrel or batch (Willett Family Estate, Old Fitzgerald 11, Kentucky Owl,
EH Taylor Barrel Proof, Penelope Barrel Strength, Peerless, Old Forester
Single Barrel Rye); page and record ABV or age disagree (Ohishi Sakura and
Sherry, Hard Truth Sweet Mash Rye, Castle & Key Wheated, Jack Daniel's 14
Batch 02); no ABV on the page (Crown Royal 32 Extra Rare, Leopold Bros
Barrel 28, Rossville Union pick, Sazerac-owned picks); brands with no
entity (Old Man Winter, Luckenbach Road, Hogsworth, Freedom Fighter); and
commemorative packaging whose liquid is not identified (Jim Beam LA Dodgers
60th).

Conventions applied: a commemorative or artist packaging of a standard
release matches the base Bottle (Johnnie Walker Blue Diwali and Year of the
Goat, WhistlePig PiggyBank 10); a Diageo Special Release keeps the Special
Releases Brand; the classifier's "bottler self-reference" on an official
distillery release is not a conflict.

Catalog cleanup seen in this lane (not done, needs approval): duplicates
2936 / 1067 (Old Pulteney 12), 2308 / 16107 (Arran Bothy), 12946 / 17526
(WhistlePig 10), 45643 / 55800 (Lot No. 40), 1154 / 701 (Bunnahabhain
Toiteach), 3928 / 476 (Tomatin 12), 61976 / 46754 (Courage & Conviction),
56003 / 54324 (Jack Daniel's Heritage Barrel), 781 / 41258 (Bunnahabhain
Stiùireadair), 860 / 14 (Jim Beam white label), 58121 (generic Evan Williams
Single Barrel Vintage next to vintage records); wrong fields: 14135 brand
"Rieger's", 11943 Sagamore Spirit Rye stated age 7, 54208 Heaven Hill
Chinquapin age 6 (page says 2018 fill, 2025 release), 45238 Bladnoch Vinaya
43.4%, 55611 Starward Octave Barrel age 3, 14207 Barrell Rye Batch 002 on
brand 37 instead of Barrell Craft Spirits 75635, 1322 / 1323 Ardnamurchan
cask-strength bottler self-reference, 56831 FUK brand is the distillery
name, 45992 Hearach brand vs entity 367043.

New Keg N Bottle proposals kept arriving during the pass (35369 onward);
they were not chased and stay for the next pass.
