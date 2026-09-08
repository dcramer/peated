# Production Bottler Identity Inventory

Initial inventory observed 2026-09-03 against `https://api.peated.com`. The approved production corrections and verification results are recorded below.

## Suntory E1383

The Bottle list reports 213 active Bottles using Suntory E1383 as bottler. Every Bottle is in a different singleton BottleGroup, so the inventory contains 213 Bottles and 213 groups. The Entity summary reports 214 total Bottles because Suntory is also the Brand for 1 Bottle; that total is not a bottler count.

| Brand                         | Bottles | Groups | Status          |
| ----------------------------- | ------: | -----: | --------------- |
| Chita Distillery              |       4 |      4 | Confirmed wrong |
| Hakushu Distillery            |      69 |     69 | Confirmed wrong |
| Hibiki                        |      29 |     29 | Confirmed wrong |
| Suntory Whisky                |       3 |      3 | Confirmed wrong |
| The Essence of Suntory Whisky |      12 |     12 | Confirmed wrong |
| Toki                          |       2 |      2 | Confirmed wrong |
| Whisky Shop W.                |      19 |     19 | Confirmed wrong |
| Yamazaki                      |      75 |     75 | Confirmed wrong |

### Evidence and proposed correction

- Suntory's official portfolios identify Chita, Hakushu, Hibiki, Toki, Yamazaki, and Suntory Whisky products as its own whisky brands and releases: <https://house.suntory.com/products/whisky>, <https://www.suntory.com/our-brands/category/spirits.html>, and <https://www.suntory.co.jp/whisky/>.
- Suntory's official Essence pages describe the series and its releases from Suntory's own Yamazaki, Hakushu, and Chita distilleries: <https://www.suntory.co.jp/whisky/essence/>.
- Suntory's official 2010 news archive records Whisky Shop W. opening in the Suntory Building. Contemporary coverage calls it Suntory's flagship whisky store, and a representative Whisky Shop W. Yamazaki release is cataloged as an official distillery bottling: <https://www.suntory.com/news/2010.html>, <https://nonjatta.blogspot.com/2014/09/WhiskyShopW.html>, and <https://whisky.auction/auctions/lot/4905/yamazaki-2000-whisky-shop-w>.
- B3789 / group 11400, Hakushu Distillery 18-year-old, is also documented on Suntory's official product page: <https://house.suntory.com/hakushu-whisky/hakushu-18-years-old>.
- B11863 / group 12545, Hibiki 21-year-old, has a checked-in production regression with verified sources in `packages/bottle-classifier/src/eval-fixtures/audit-cases/production-hibiki-21-missing-abv-not-bottler.json`.

Together, this evidence establishes that the 213 Bottles below are official Suntory releases. Suntory is the producer or corporate owner, not an independent bottler for these releases. The proposed patch for every listed Bottle is `{ "bottler": null }`. No other Bottle field or relationship is in scope. Every BottleGroup is a singleton, so each patch affects exactly one Bottle.

### Exact production scope

#### Chita Distillery

- B51831 / group 24791: Chita Distillery 12-year-old Single Grain Whisky
- B51832 / group 24792: Chita Distillery 17-year-old Single Grain Whisky
- B51830 / group 24790: Chita Distillery Aichi Edition
- B16937 / group 15247: Chita Distillery Single Grain

#### Hakushu Distillery

- B17155 / group 15431: Hakushu Distillery 10-year-old
- B51774 / group 24734: Hakushu Distillery 10-year-old
- B51792 / group 24752: Hakushu Distillery 10-year-old From the Barrel
- B17202 / group 15474: Hakushu Distillery 12-year-old
- B51796 / group 24756: Hakushu Distillery 12-year-old
- B51793 / group 24753: Hakushu Distillery 12-year-old From the Barrel
- B51794 / group 24754: Hakushu Distillery 15-year-old From the Barrel
- B3789 / group 11400: Hakushu Distillery 18-year-old
- B51795 / group 24755: Hakushu Distillery 20-year-old From the Barrel
- B17154 / group 15430: Hakushu Distillery 25-year-old
- B51791 / group 24751: Hakushu Distillery 8-year-old From the Barrel
- B51780 / group 24740: Hakushu Distillery Bourbon Barrel
- B47019 / group 19979: Hakushu Distillery Distiller's Reserve
- B51789 / group 24749: Hakushu Distillery Distillery Exclusive
- B51790 / group 24750: Hakushu Distillery Distillery Exclusive
- B16799 / group 15127: Hakushu Distillery Heavily Peated
- B51775 / group 24735: Hakushu Distillery Heavily Peated
- B51776 / group 24736: Hakushu Distillery Heavily Peated
- B51777 / group 24737: Hakushu Distillery Heavily Peated
- B51786 / group 24746: Hakushu Distillery Japanese Forest Bittersweet Edition
- B51787 / group 24747: Hakushu Distillery Kogei Collection Peated Malt Spanish Oak
- B44131 / group 17953: Hakushu Distillery Peated Malt - 100th Anniversary Edition
- B51781 / group 24741: Hakushu Distillery Peated Malt - 2021 Edition
- B51782 / group 24742: Hakushu Distillery Peated Malt - 2024 Edition
- B51783 / group 24743: Hakushu Distillery Peated Malt - 2025 Edition
- B51798 / group 24758: Hakushu Distillery Pure Malt Whisky - 2007 Limited Edition
- B51797 / group 24757: Hakushu Distillery Pure Malt Whisky - 30th Anniversary
- B16803 / group 15131: Hakushu Distillery Sherry Cask
- B51778 / group 24738: Hakushu Distillery Sherry Cask
- B51779 / group 24739: Hakushu Distillery Sherry Cask
- B51883 / group 24843: Hakushu Distillery Sherry Cask - The Whisky Exchange 10th Anniversary
- B51884 / group 24844: Hakushu Distillery Single Cask Whisky - Whisky Live 10th Anniversary
- B51788 / group 24748: Hakushu Distillery Single Malt Whisky
- B51784 / group 24744: Hakushu Distillery Spanish Oak - 2021 Edition
- B51785 / group 24745: Hakushu Distillery Story of the Distillery
- B51885 / group 24845: Hakushu Distillery Suntory Single Cask Whisky - Isetan
- B51855 / group 24815: Hakushu Distillery The Cask of Hakushu
- B51856 / group 24816: Hakushu Distillery The Cask of Hakushu
- B51857 / group 24817: Hakushu Distillery The Cask of Hakushu
- B51858 / group 24818: Hakushu Distillery The Cask of Hakushu
- B51859 / group 24819: Hakushu Distillery The Cask of Hakushu
- B51860 / group 24820: Hakushu Distillery The Cask of Hakushu
- B51868 / group 24828: Hakushu Distillery The Cask of Hakushu
- B51869 / group 24829: Hakushu Distillery The Cask of Hakushu
- B51870 / group 24830: Hakushu Distillery The Cask of Hakushu
- B51871 / group 24831: Hakushu Distillery The Cask of Hakushu
- B51872 / group 24832: Hakushu Distillery The Cask of Hakushu
- B51873 / group 24833: Hakushu Distillery The Cask of Hakushu
- B51874 / group 24834: Hakushu Distillery The Cask of Hakushu
- B51875 / group 24835: Hakushu Distillery The Cask of Hakushu
- B51876 / group 24836: Hakushu Distillery The Cask of Hakushu
- B51877 / group 24837: Hakushu Distillery The Cask of Hakushu
- B51878 / group 24838: Hakushu Distillery The Cask of Hakushu
- B51879 / group 24839: Hakushu Distillery The Cask of Hakushu
- B51861 / group 24821: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51862 / group 24822: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51863 / group 24823: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51864 / group 24824: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51865 / group 24825: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51866 / group 24826: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51867 / group 24827: Hakushu Distillery The Cask of Hakushu Heavily Peated
- B51799 / group 24759: Hakushu Distillery Vintage Malt
- B51800 / group 24760: Hakushu Distillery Vintage Malt
- B51801 / group 24761: Hakushu Distillery Vintage Malt
- B51802 / group 24762: Hakushu Distillery Vintage Malt
- B51803 / group 24763: Hakushu Distillery Vintage Malt
- B51804 / group 24764: Hakushu Distillery Vintage Malt
- B51805 / group 24765: Hakushu Distillery Vintage Malt
- B51882 / group 24842: Hakushu Distillery Vintage Malt Sherry Cask

#### Hibiki

- B51825 / group 24785: Hibiki 100th Anniversary Blend
- B11864 / group 12546: Hibiki 12-year-old
- B51889 / group 24849: Hibiki 12-year-old - Travel Exclusive Series
- B47566 / group 20526: Hibiki 17-year-old
- B51815 / group 24775: Hibiki 17-year-old - Non-Chill Filtered
- B11863 / group 12545: Hibiki 21-year-old
- B51826 / group 24786: Hibiki 21-year-old - 100th Anniversary Edition
- B11866 / group 12548: Hibiki 30-year-old
- B51828 / group 24788: Hibiki 35-year-old
- B51827 / group 24787: Hibiki 35-year-old - Sakaida Kakiemon XIV
- B51829 / group 24789: Hibiki 40-year-old
- B51816 / group 24776: Hibiki Blender's Choice
- B51819 / group 24779: Hibiki Blossom Harmony - 2021 Release
- B51820 / group 24780: Hibiki Blossom Harmony - 2022 Release
- B51821 / group 24781: Hibiki Blossom Harmony - 2023 Release
- B51822 / group 24782: Hibiki Blossom Harmony - 2024 Release
- B51823 / group 24783: Hibiki Blossom Harmony - 2025 Release
- B51824 / group 24784: Hibiki Blossom Harmony - 2026 Release
- B51817 / group 24777: Hibiki Deep Harmony
- B11865 / group 12547: Hibiki Japanese Harmony
- B52828 / group 25788: Hibiki Japanese Harmony - 2025 Festive Edition
- B45206 / group 18166: Hibiki Japanese Harmony Master's Select
- B52829 / group 25789: Hibiki Japanese Harmony Master's Select - 100th Anniversary of Suntory Whisky
- B52827 / group 25787: Hibiki Japanese Harmony Master's Select - Kacho Fugetsu Limited Edition
- B52830 / group 25790: Hibiki Japanese Harmony Master's Select - Lunar New Year 2026
- B52826 / group 25786: Hibiki Japanese Harmony - Ryusui-Hyakka 2021
- B51818 / group 24778: Hibiki Mellow Harmony
- B51888 / group 24848: Hibiki Millennium 2000
- B51814 / group 24774: Hibiki Suntory Whisky

#### Suntory Whisky

- B51834 / group 24794: Suntory Whisky Kakubin
- B52775 / group 25735: Suntory Whisky Old
- B51835 / group 24795: Suntory Whisky Special Reserve

#### The Essence of Suntory Whisky

- B396 / group 9091: The Essence of Suntory Whisky Blended Japanese Whisky Clean Type
- B51730 / group 24690: The Essence of Suntory Whisky Blended Japanese Whisky Rich Type
- B51732 / group 24692: The Essence of Suntory Whisky Chita Distillery Sakura Cask Finish Blend
- B51726 / group 24686: The Essence of Suntory Whisky Chita Distillery Wine Cask Finish
- B51725 / group 24685: The Essence of Suntory Whisky Hakushu Distillery Rye Type
- B51731 / group 24691: The Essence of Suntory Whisky Rice Whisky
- B51733 / group 24693: The Essence of Suntory Whisky Yamazaki Distillery Golden Promise
- B51734 / group 24694: The Essence of Suntory Whisky Yamazaki Distillery Islay Peated Malt
- B51728 / group 24688: The Essence of Suntory Whisky Yamazaki Distillery Montilla Wine Cask
- B51724 / group 24684: The Essence of Suntory Whisky Yamazaki Distillery Peated Malt
- B51729 / group 24689: The Essence of Suntory Whisky Yamazaki Distillery Refill Sherry Cask
- B51727 / group 24687: The Essence of Suntory Whisky Yamazaki Distillery Spanish Oak

#### Toki

- B45635 / group 18595: Toki Black
- B51833 / group 24793: Toki Blended Japanese Whisky

#### Yamazaki

- B5123 / group 12156: Yamazaki 10-year-old
- B2276 / group 10447: Yamazaki 12-year-old
- B14506 / group 14246: Yamazaki 18-year-old
- B17672 / group 15729: Yamazaki 1984
- B12856 / group 12746: Yamazaki 25-year-old
- B51622 / group 24582: Yamazaki 25-year-old
- B51623 / group 24583: Yamazaki 35-year-old
- B51624 / group 24584: Yamazaki 50-year-old
- B51625 / group 24585: Yamazaki 50-year-old
- B51626 / group 24586: Yamazaki 50-year-old
- B51628 / group 24588: Yamazaki 55-year-old
- B51621 / group 24581: Yamazaki 60th Anniversary Gold Bottle
- B51629 / group 24589: Yamazaki 80th Anniversary
- B45989 / group 18949: Yamazaki Distiller's Reserve
- B51749 / group 24709: Yamazaki Distillery Exclusive
- B51750 / group 24710: Yamazaki Distillery Exclusive
- B51684 / group 24644: Yamazaki Golden Promise - 2024 Edition
- B51685 / group 24645: Yamazaki Islay Peated Malt - 2024 Edition
- B51688 / group 24648: Yamazaki Japan Edition
- B970 / group 9569: Yamazaki Limited Edition - 2014
- B51074 / group 24034: Yamazaki Limited Edition - 2015
- B51076 / group 24036: Yamazaki Limited Edition - 2016
- B51077 / group 24037: Yamazaki Limited Edition - 2017
- B51078 / group 24038: Yamazaki Limited Edition - 2021
- B51080 / group 24040: Yamazaki Limited Edition - 2022
- B51081 / group 24041: Yamazaki Limited Edition - 2023
- B47537 / group 20497: Yamazaki Mizunara 18-year-old
- B51627 / group 24587: Yamazaki Mizunara 25-year-old
- B51689 / group 24649: Yamazaki Peated Malt Spanish Oak
- B51630 / group 24590: Yamazaki Plum Liqueur Cask Finish
- B51631 / group 24591: Yamazaki Sherry Wood
- B51632 / group 24592: Yamazaki Sherry Wood
- B51633 / group 24593: Yamazaki Sherry Wood
- B51634 / group 24594: Yamazaki Sherry Wood
- B51635 / group 24595: Yamazaki Sherry Wood
- B51072 / group 24032: Yamazaki Single Malt
- B51683 / group 24643: Yamazaki Smoky Batch - The First
- B51686 / group 24647: Yamazaki Smoky Batch - The Fourth
- B51682 / group 24642: Yamazaki Smoky Batch - The Second
- B51687 / group 24646: Yamazaki Smoky Batch - The Third
- B51083 / group 24043: Yamazaki Story of the Distillery - 2024 Edition
- B51084 / group 24044: Yamazaki Story of the Distillery - 2025 Edition
- B51086 / group 24046: Yamazaki Story of the Distillery - 2026 Edition
- B51760 / group 24720: Yamazaki The Cask of Yamazaki - Heavily Peated Malt
- B51761 / group 24721: Yamazaki The Cask of Yamazaki - Heavily Peated Malt
- B51762 / group 24722: Yamazaki The Cask of Yamazaki - Heavily Peated Malt
- B51763 / group 24723: Yamazaki The Cask of Yamazaki - Heavily Peated Malt
- B51755 / group 24715: Yamazaki The Cask of Yamazaki - Hogshead
- B51751 / group 24711: Yamazaki The Cask of Yamazaki - Japanese Oak Cask
- B51752 / group 24712: Yamazaki The Cask of Yamazaki - Mizunara Oak
- B51756 / group 24716: Yamazaki The Cask of Yamazaki - Sherry Butt
- B51757 / group 24717: Yamazaki The Cask of Yamazaki - Sherry Butt
- B51758 / group 24718: Yamazaki The Cask of Yamazaki - Sherry Butt
- B51759 / group 24719: Yamazaki The Cask of Yamazaki - Sherry Butt
- B51753 / group 24713: Yamazaki The Cask of Yamazaki - Sherry Cask
- B51754 / group 24714: Yamazaki The Cask of Yamazaki - White Oak Cask
- B51705 / group 24665: Yamazaki Vintage Malt
- B51706 / group 24666: Yamazaki Vintage Malt
- B51707 / group 24667: Yamazaki Vintage Malt
- B51708 / group 24668: Yamazaki Vintage Malt
- B51709 / group 24669: Yamazaki Vintage Malt
- B51710 / group 24670: Yamazaki Vintage Malt
- B51711 / group 24671: Yamazaki Vintage Malt
- B51712 / group 24672: Yamazaki Vintage Malt
- B51713 / group 24673: Yamazaki Vintage Malt
- B51714 / group 24674: Yamazaki Vintage Malt
- B51715 / group 24675: Yamazaki Vintage Malt
- B51716 / group 24676: Yamazaki Vintage Malt
- B51717 / group 24677: Yamazaki Vintage Malt
- B51718 / group 24678: Yamazaki Vintage Malt
- B51719 / group 24679: Yamazaki Vintage Malt
- B51720 / group 24680: Yamazaki Vintage Malt
- B51721 / group 24681: Yamazaki Vintage Malt
- B51722 / group 24682: Yamazaki Vintage Malt
- B51723 / group 24683: Yamazaki Vintage Malt

#### Whisky Shop W.

- B51849 / group 24809: Whisky Shop W. Chita Distillery - WSO-004
- B51839 / group 24799: Whisky Shop W. Hakushu Distillery - 1st Anniversary
- B51841 / group 24801: Whisky Shop W. Hakushu Distillery - 2nd Anniversary
- B51843 / group 24803: Whisky Shop W. Hakushu Distillery - 3rd Anniversary
- B51845 / group 24805: Whisky Shop W. Hakushu Distillery - 4th Anniversary
- B51837 / group 24797: Whisky Shop W. Hakushu Distillery - Opening Anniversary
- B51846 / group 24806: Whisky Shop W. Hakushu Distillery - WSO-001
- B51847 / group 24807: Whisky Shop W. Hakushu Distillery - WSO-002
- B51848 / group 24808: Whisky Shop W. Hakushu Distillery - WSO-003
- B51851 / group 24811: Whisky Shop W. Hakushu Distillery - WSO-006
- B51853 / group 24813: Whisky Shop W. Hakushu Distillery - WSO-008
- B51838 / group 24798: Whisky Shop W. Yamazaki Distillery - 1st Anniversary
- B51840 / group 24800: Whisky Shop W. Yamazaki Distillery - 2nd Anniversary
- B51842 / group 24802: Whisky Shop W. Yamazaki Distillery - 3rd Anniversary
- B51844 / group 24804: Whisky Shop W. Yamazaki Distillery - 4th Anniversary
- B51836 / group 24796: Whisky Shop W. Yamazaki Distillery - Opening Anniversary
- B51850 / group 24810: Whisky Shop W. Yamazaki Distillery - WSO-005
- B51852 / group 24812: Whisky Shop W. Yamazaki Distillery - WSO-007
- B51854 / group 24814: Whisky Shop W. Yamazaki Distillery - WSO-009

## Venture Whisky E365718

Venture Whisky owns both Ichiro's Malt and Chichibu in Peated. Its 38 Chichibu single malts are official distillery releases, not independent bottlings. Japan Airlines also describes Chichibu as Venture Whisky's distillery and these releases as Chichibu single malts: <https://press.jal.co.jp/en/release/202410/008424.html>.

The proposed patch for these 38 Bottles in 35 groups is `{ "bottler": null }`:

- B45195 / group 18155: Ichiro's Chichibu 10-year-old Single Malt
- B51691 / group 24651: Ichiro's Chichibu Distillery II Hint of Sherry - 2026
- B45197 / group 18157: Ichiro's Chichibu Distillery II Single Malt
- B13371 / group 13226: Ichiro's Chichibu On The Way - 2019
- B51692 / group 24652: Ichiro's Chichibu On The Way Floor Malted - 2024
- B44058 / group 17881: Ichiro's Chichibu Peated The U.S. Edition
- B45078 / group 17881: Ichiro's Chichibu Peated The U.S. Edition - 2020
- B51698 / group 24658: Ichiro's Chichibu Red Wine Cask - 2023
- B51612 / group 24572: Ichiro's Chichibu Single Barrel Clever Cask
- B51613 / group 24573: Ichiro's Chichibu Single Barrel Found Cask
- B51614 / group 24574: Ichiro's Chichibu Single Barrel Lazy Cask
- B51615 / group 24575: Ichiro's Chichibu Single Barrel Tomodachi
- B51693 / group 24653: Ichiro's Chichibu Single Cask
- B51694 / group 24654: Ichiro's Chichibu Single Cask
- B51618 / group 24578: Ichiro's Chichibu Single Cask Bird and Snake
- B51617 / group 24577: Ichiro's Chichibu Single Cask Cat and Mouse
- B51619 / group 24579: Ichiro's Chichibu Single Cask Crow
- B51616 / group 24576: Ichiro's Chichibu Single Cask Night's Parade of 100 Demons
- B51620 / group 24580: Ichiro's Chichibu Single Cask Tiger
- B51695 / group 24655: Ichiro's Chichibu The Peated - 2022
- B51690 / group 24650: Ichiro's Chichibu The Peated - 2026
- B44037 / group 17862: Ichiro's Chichibu The U.S. Edition
- B45039 / group 17862: Ichiro's Chichibu The U.S. Edition - 2019
- B45191 / group 18151: Ichiro's Chichibu The U.S. Edition - 2021
- B45038 / group 17862: Ichiro's Chichibu The U.S. Edition - 2022
- B45194 / group 18154: Ichiro's Chichibu The U.S. Edition - 2023
- B45184 / group 18144: Ichiro's Chichibu The U.S. Edition - 2024
- B45196 / group 18156: Ichiro's Chichibu The U.S. Edition - 2025
- B51703 / group 24663: Ichiro's Chichibu Year of the Boar
- B51700 / group 24660: Ichiro's Chichibu Year of the Dragon
- B51697 / group 24657: Ichiro's Chichibu Year of the Horse
- B51702 / group 24662: Ichiro's Chichibu Year of the Ox
- B51699 / group 24659: Ichiro's Chichibu Year of the Rabbit
- B51704 / group 24664: Ichiro's Chichibu Year of the Rat
- B51696 / group 24656: Ichiro's Chichibu Year of the Snake
- B51701 / group 24661: Ichiro's Chichibu Year of the Tiger
- B52469 / group 25429: Ichiro's Chichibu - 佛像與武甲山
- B52575 / group 25535: Ichiro's Moeginomura 50th Anniversary

The other 4 Venture Whisky assignments are blends made with whisky from other producers. They remain unchanged until evidence confirms Venture Whisky's role for each release: B45187, B45036, B44036, and B45037.

Result: 35 BottleGroups and all 38 Chichibu Bottles were cleared and verified. The four unresolved blends were unchanged. Venture Whisky's Entity total was recalculated to 4.

## Other confirmed official releases

The 44 singleton Bottles below are official Brand or distillery releases. The named company owns, makes, blends, or releases the product as part of its own range; it is not an independent Bottler for that product.

| Entity                                      | Exact Bottle / group pairs                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old Rip Van Winkle Distillery E366146       | B11867/G12549, B11868/G12550, B43836/G17674, B44138/G17960, B52755/G25715, B52756/G25716, B52758/G25718, B52759/G25719, B52760/G25720, B52761/G25721, B52766/G25726 |
| John Distilleries E1770                     | B462/G9151, B463/G9152, B524/G9206, B593/G9259, B670/G9324, B1855/G10174, B2192/G10389, B46352/G19312                                                               |
| Heaven Hill E1013                           | B505/G9189, B786/G9418, B4161/G11633, B45480/G18440, B47138/G20098                                                                                                  |
| Nikka E1202                                 | B1005/G9596, B43248/G17097, B45741/G18701, B46946/G19906, B47565/G20525                                                                                             |
| William Grant & Sons E5821                  | B2637/G10676, B2638/G10677, B6182/G12406, B9874/G12479                                                                                                              |
| J. & G. Grant Ltd. E3139                    | B45438/G18398, B46871/G19831, B47258/G20218                                                                                                                         |
| Chivas Brothers E316                        | B52354/G25314, B52394/G25354                                                                                                                                        |
| Het Anker E366019                           | B47090/G20050                                                                                                                                                       |
| Hotaling & Co. E6097                        | B22/G9085                                                                                                                                                           |
| John Dewar & Sons Ltd. E5554                | B4030/G11554                                                                                                                                                        |
| Kirin Holdings E365936                      | B46365/G19325                                                                                                                                                       |
| Morrison Glasgow Distillers Limited E366425 | B52444/G25404                                                                                                                                                       |
| Sazerac E1312                               | B47081/G20041                                                                                                                                                       |

Evidence:

- Old Rip Van Winkle and Buffalo Trace describe the Van Winkle range as their joint official production, including the older Stitzel-Weller stock: <https://oldripvanwinkle.com/heritage/> and <https://www.buffalotracedistillery.com/our-brands/van-winkle/>.
- Paul John's official range lists the eight Paul John expressions: <https://pauljohnwhisky.com/bold.php>.
- Heaven Hill's official portfolio includes Elijah Craig, Rittenhouse, Larceny, and Heaven Hill releases: <https://heavenhilldistillery.com/our-brands.php>.
- Nikka's official product history and range list Coffey Grain, From the Barrel, Nine Decades, and Super Nikka: <https://www.nikka.com/en/story/history/> and <https://www.nikka.com/en/brands/>.
- William Grant & Sons lists Monkey Shoulder and Aerstone as its own brands: <https://www.williamgrant.com/gb/we/>.
- Glenfarclas identifies these as its own single malt range and the Grant family's distillery: <https://glenfarclas.com/>.
- Chivas Brothers lists Chivas Regal in its own whisky portfolio: <https://www.chivasbrothers.com/our-brands/chivas-regal>.
- The remaining official pages identify the exact product or the company-operated distillery: <https://www.hetanker.be/en/drinks/gouden-carolus-1st-anniversary-edition-gold-fusion>, <https://www.hotalingandco.com/brand-assets/?brand_id=3246&product_id=>, <https://www.dewars.com/us/en/dewars-whiskies/dewars-15-year-old-whisky/>, <https://www.kirin.co.jp/experience/factory/en/gotemba/whiskeyjourney/>, <https://theclydeside.com/our-whisky/our-whiskies/>, and <https://www.sazerac.com/our-brands/sazerac-brands/mister-sam.html>.

Result: all 44 Bottles were cleared and verified. Updating two older imports also rebuilt stale display names that contained structured ABV or age text. Their stored age, year, strength, cask, Brand, distiller, and group data did not change. Each Entity total was recalculated and independently matched against its live Brand, Bottler, and distiller Bottle union.

## Diageo E5558

These five singleton Bottles are official Diageo products, made only with whisky from Diageo-owned distilleries. Diageo is their producer or Brand owner, not an independent Bottler.

| Exact Bottle / group | Product evidence                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B7132/G12437         | Cladach is a Diageo Special Release blended from six Diageo coastal distilleries: <https://www.malts.com/en/products/cladach-2018-blended-malt-scotch-whisky-70cl>.                              |
| B9388/G12466         | Collectivum XXVIII is a Diageo Special Release blended from all 28 Diageo malt distilleries: <https://www.thespiritsbusiness.com/2017/09/diageo-reveals-full-details-of-special-releases-2017/>. |
| B9735/G12474         | Diageo describes Copper Dog as its Brand and blend: <https://media.diageo.com/diageo-corporate-media/media/lsudcvp0/161_john_kennedy_scotch.pdf>.                                                |
| B46016/G18976        | Diageo's official malt shop lists Benrinnes 15 as a Flora and Fauna distillery release: <https://www.malts.com/en-gb/products/benrinnes-15-year-old-flora-fauna-single-malt-whisky-70cl>.        |
| B52577/G25537        | The Directors' Blend was made from Diageo distilleries and given to Diageo staff: <https://whisky.auction/auctions/lot/8110/diageo-the-directors-blend>.                                         |

Approved patch: clear only `bottler` on these five BottleGroups after the live IDs, membership, and relationships match this inventory.

Result: all five Bottles were cleared and verified. Diageo now has zero Bottler uses, and its Entity total matches its two remaining Brand or distiller relationships.

## Additional confirmed producer releases

These six singleton Bottles are official releases from the company that made the whisky or owned its distillery at release time. None is an independent bottling.

| Entity                               | Exact Bottle / group pairs   | Evidence                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heaven Hill E1013                    | B45462/G18422, B45487/G18447 | J.O. Blackburn was distilled and bottled by Heaven Hill, and Quality House is an in-house Heaven Hill Brand: <https://www.oldliquorcompany.com/en_GB/shop/jo-blackburn-12-years-26205> and <https://www.breakingbourbon.com/review/quality-house-old-style-bourbon>.                                             |
| Thomson Whisky New Zealand Ltd E1956 | B46693/G19653                | Thomson says South Island Peat is distilled through its own stills: <https://thomsonwhisky.co.nz/products/victor-gin>. Its sourced Two Tone blend and The Heart Cut release remain unchanged.                                                                                                                    |
| John Haig & Co. Ltd. E5760           | B955/G9558                   | Diageo's official product page says Haig Club is made at its Cameronbridge distillery: <https://www.malts.com/en-gb/products/haig-club-single-grain-scotch-whisky>.                                                                                                                                              |
| William Lawson Distillers Ltd. E5660 | B52262/G25222, B52314/G25274 | Both Glen Deveron 5-year-olds are official Macduff bottlings from the period when William Lawson owned the distillery: <https://whiskyauctioneer.com/learn/explore-whisky/distilleries/macduff> and <https://www.just-whisky.co.uk/product/glen-deveron-5-years-old-mac-duff-1980s-william-lawson-75cl-1397656>. |

Approved patch: clear only `bottler` on these six BottleGroups after the live IDs, membership, and relationships match this inventory.

Result: all six Bottles were cleared and verified. Their four Entity totals match their current Bottle relationships.

## Teeling producer releases

Teeling remains the Bottler for its sourced whisky. These four singleton Bottles are different: producer material identifies them as whisky distilled at Teeling's Dublin distillery.

| Exact Bottle / group | Product evidence                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B7472/G12447         | Teeling describes Single Pot Still as its first Dublin-distilled whiskey: <https://www.teelingwhiskey.com/us/en/teeling-whiskeys/single-pot-still-whiskey/>.                                                                                                                                                  |
| B46716/G19676        | Teeling says the second Virgin Portuguese Oak release was triple distilled at its Dublin distillery: <https://www.teelingwhiskey.com/us/en/limited-edition-bottlings/>.                                                                                                                                       |
| B46999/G19959        | Teeling identifies Blackpitts Cask Strength as a Dublin-distilled peated single malt: <https://teelingdistillery.com/product/blackpitts-cask-strength-peated-single-malt/>.                                                                                                                                   |
| B47359/G20319        | Bacardi's Teeling announcement says the 10th Birthday Batch came from Teeling Distillery inventory: <https://media.bacardilimited.com/en/p/5815/teeling-whiskey-celebrates-a-decade-of-distilling-excellence-in-the-heart-of-dublin-with-limited-edition-birthday-batch-bottling-and-year-long-celebrations>. |

Approved patch: clear only `bottler` on these four BottleGroups after the live IDs, membership, and relationships match this inventory. Keep the other Teeling assignments until product evidence establishes whether each whisky was distilled by Teeling or sourced.

Result: all four Bottles were cleared and verified. Teeling's other 28 Bottler uses were unchanged.

## Remaining reviewed candidates

After the confirmed corrections above, the first scan leaves 32 reviewed entities used as bottler for 89 Bottles. Entity kind, Brand ownership, and name are not proof of an error. These sets remain unchanged until product evidence proves or disproves the Bottler role.

|  Entity | Name                             | Bottler Bottles |
| ------: | -------------------------------- | --------------: |
|   E5323 | Teeling Whiskey Company          |              28 |
|   E5658 | Ian Macleod Distillers           |              11 |
|   E5422 | Whiskybase.com                   |               9 |
|   E1980 | Walsh Whiskey                    |               5 |
|   E5190 | Kirsch Import                    |               3 |
|   E1956 | Thomson Whisky New Zealand Ltd   |               2 |
|   E6022 | Angus Dundee Distillers          |               2 |
|   E3417 | Maverick Drinks                  |               2 |
|  E29403 | Mitchell & Son                   |               2 |
|   E5340 | Sliabh Liag Distillers           |               2 |
|   E1494 | Whyte & Mackay                   |               2 |
|   E5508 | Arthur Bell & Sons               |               1 |
|   E5677 | Campbeltown Whisky Company Ltd   |               1 |
|    E240 | Corby Spirit and Wine Ltd.       |               1 |
| E366187 | Direct Wines                     |               1 |
|   E5785 | Duncan Piper (Scotland) Limited  |               1 |
|   E6041 | Findlater Mackie Todd & Co. Ltd. |               1 |
|   E5599 | J.G. Thomson & Co. Ltd.          |               1 |
| E365734 | J.W. Rutledge                    |               1 |
|   E5800 | James Parker Scotland Limited    |               1 |
| E366623 | Justerini & Brooks               |               1 |
|   E5454 | Justerini & Brooks Ltd.          |               1 |
|   E3256 | Kirker Greer                     |               1 |
|   E5620 | Macdonald & Muir Ltd.            |               1 |
|   E1824 | Matsui Shuzo                     |               1 |
|   E5763 | Peter J. Russell & Co. Ltd       |               1 |
|   E5321 | Proud Irish Whiskey Company Ltd  |               1 |
| E366129 | Rudolf Jelínek                   |               1 |
| E366674 | Sanraku Co.                      |               1 |
| E366484 | Sansibar-Whisky GmbH             |               1 |
|   E6030 | The Wine Society                 |               1 |
|   E5462 | Wm. Teacher & Sons Ltd.          |               1 |

## Full catalog audit

A read-only scan after these corrections found 16,987 active Bottles and 11,147 populated Bottler relationships across 675 Entities. Of those relationships, 3,727 use an Entity whose catalog kind is not `bottler`: 3,249 use a distillery, 384 use a Brand, and 94 use a company. Kind controls browse placement and does not prove whether a Bottle relationship is right, so these are candidates, not confirmed errors.

Within that inventory, 1,055 Bottles in 970 groups also use the Bottler Entity as a distiller. The 968 complete groups contain 1,049 Bottles. Groups 10730 and 10731 have mixed per-Bottle distiller evidence and need extra care. The identity rule says relationship overlap alone is not proof, so no record was changed from this scan without product evidence.

## Approval state

The user approved production cleanup on 2026-09-03, beginning with Suntory, then directed continued cleanup of other verified errors. Only the exact confirmed sets above are approved. Ambiguous candidates remain read-only.

The corrected rule was deployed at API commit `7be4992e60ccf86df112246bcb31d776b6fef9e7`. Immediately before writing, the live Suntory inventory still contained the same 213 Bottle IDs and group IDs, every group was a singleton, and every group used Suntory E1383 as bottler. No extra or missing Bottle was found.

In total, the correction cleared and verified 310 Bottles in 307 BottleGroups. Suntory now has zero Bottler uses and one Brand use; its Entity total is 1. Venture Whisky retains its four unresolved world blends and has an Entity total of 4. Every changed Entity total was reconciled against its current Bottle relationships.
