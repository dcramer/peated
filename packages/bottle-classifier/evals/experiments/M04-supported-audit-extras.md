# M04: supported audit extras

**Accepted as a scoring correction.** The classifier did not change. Audit
test cases may now list exact, independently reviewed operation sets that include
the required repairs plus supported optional repairs.

## Scoring rule

The normal expected operation set remains required. A test case may also provide
one or more `acceptedProposedOperationSets`. Each set must contain every required
operation and field. A model output passes the operation judge only when it
exactly matches the normal set or one complete accepted set.

This keeps the boundary narrow:

- a different field, value, or target still fails;
- omitting a required repair still fails;
- findings remain exact and are not covered by accepted operation sets;
- every operation target and evidence reference must still be collected;
- required evidence is checked against the accepted set selected by the scorer.

The test case schema rejects an accepted set that omits a required operation or
field. An explicit Laphroaig guard test also confirms that updating the merge
source fails when only an update to the surviving Bottle is accepted.

## Reviewed cases

| Case                                | Supported optional repair                                                                                                   | Evidence                                                                                                                                                        | Still rejected                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Laphroaig Càirdeas 2022 Warehouse 1 | Add the producer's maturation to surviving Bottle 45146 after merging malformed Bottle 39096 into it.                       | Laphroaig says the exact release was aged in first-fill Maker's Mark Bourbon casks in Warehouse 1.                                                              | Updating Bottle 39096, reversing the merge, or any different survivor patch.                                                  |
| Pōkeno Single Cask                  | Add `outturn: 340` with the required 2019 vintage.                                                                          | The checked-in label reads `BOTTLE No 008/340`; 008 is the bottle number and 340 is the total outturn.                                                          | Treating the small `71` sticker as a verified cask number, changing populated identity fields, or adding unexpected findings. |
| SMWS 10.258 Quo vadis?              | Add `caskNumber: "10.258"` and the reviewed two-stage maturation with the required ABV, single-cask flag, and 2013 vintage. | SMWS identifies the product as Cask No. 10.258 and says it spent five years in an ex-bourbon hogshead before transfer to a first-fill American oak PX hogshead. | Adding `edition: "10.258"`, because the code is already in the Bottle name; unreviewed `caskStrength` or `outturn` fields.    |

Sources:

- [Laphroaig Càirdeas 2022 Warehouse 1](https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky)
- [SMWS Cask No. 10.258](https://smwsa.com/products/cask-no-10-258)
- [checked-in Pōkeno label](../../src/eval-fixtures/assets/photo-add-bottle-misses/pokeno-single-cask-71.webp)

## Historical score correction

The saved reports were rescored without making model calls. M02 and M03 counts
are included so each correction remains traceable.

| Setting              | Recorded | After M02 | After M03 | After M04 | M04 change |
| -------------------- | -------: | --------: | --------: | --------: | ---------: |
| Terra medium, no web |   74/102 |    76/102 |    74/102 |    75/102 |         +1 |
| Luna high, no web    |   75/102 |    73/102 |    71/102 |    71/102 |          0 |
| Luna xhigh, no web   |   73/102 |    75/102 |    73/102 |    73/102 |          0 |
| Terra medium, web    |   76/102 |    78/102 |    78/102 |    79/102 |         +1 |
| Luna high, web       |   73/102 |    75/102 |    77/102 |    79/102 |         +2 |
| Luna xhigh, web      |   73/102 |    75/102 |    74/102 |    75/102 |         +1 |

The corrected outcomes are specific:

- Pōkeno now passes saved no-web Terra and web Terra outputs.
- Laphroaig now passes the saved web Luna high output.
- SMWS now passes saved web Luna high and Luna xhigh outputs.

Pōkeno remains failed for the other settings because their extra findings are
still unexpected. Web Terra's SMWS output remains failed because it also added
unreviewed `caskStrength` and `outturn` values. Missing repairs and errored or
timed-out Laphroaig runs remain failed.

These five outcomes are measurement corrections, not classifier accuracy gains.
The rescore took 0.38 seconds. It used zero model calls, tokens, model cost, or
model time.

## Verification

- Focused scoring and test case validation: 40 tests passed in 1.85 seconds.
- Full package test run: 397 tests passed in 14.82 seconds.
- Package typecheck: passed in 4.67 seconds.
- Lint and formatting: passed.

The [structured results](./M04-supported-audit-extras.json) record every reviewed
historical outcome.
