# M10: require review for name-only Double Double Oaked

**Accepted as a measurement correction.** The name-only Woodford Reserve
Double Double Oaked test case now expects review instead of a created Bottle.

Woodford Reserve has used Double Double Oaked for separate yearly releases. Its
Distillery Series history lists releases in 2015, 2017, 2018, 2019, and 2020,
and its 2023 announcement calls that bottling an annual release. There is also a
meaningful product difference: the current 700 ml product describes two extra
years in the second barrel, while the 2023 release describes one extra year.

The fixture supplies only the product name. It has no source URL, label, year,
size, or other fact that identifies one release. Creating a generic Bottle
would discard the producer's release distinctions. The safe result is
`no_match` until the source identifies a complete release. The test case now
uses `block_if_uncertain` and `review_required`.

After M09, the saved September 3 Luna-high run and C26 Variant B both score
79/105. This correction changes the saved run to 78/105 because it created a
generic product. It changes Variant B to 80/105 because it returned `no_match`.
These adjusted scores still cannot measure C26 because the runs used different
code versions and ran only once.

No classifier code or saved model output changed. The correction made no model
calls.

Sources:

- [Current Double Double Oaked producer page](https://www.woodfordreserve.com/whiskey/double-double-oaked/)
- [Woodford Reserve's 2023 annual release announcement](https://www.woodfordreserve.com/woodford-reserve-double-double-oaked-returns-as-2023-winter-distillery-series/)
- [Woodford Reserve Distillery Series release history](https://shop.woodfordreserve.com/distillery-series-12-year-old-american-single-malt-whiskey/)
