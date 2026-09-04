# M08: remove the held-out SMWS release year

**Accepted as a measurement correction.** The text-only missing-Bottle test case
no longer requires release year 2024.

The test case deliberately removes Peated Bottle 43260 from the local catalog so
it can test creation from the title and official SMWS page. Live page reads on
September 3, 2026 consistently returned cask RW6.5, the marketed subtitle,
6-year age, 56% ABV, distillation date, cask type, spirit, and region. The page
did not state a release or bottling year.

One C12 changed run found 2024 by searching the public web. Its results
included Peated Bottle 43260 and a Whiskybase snippet. Requiring that value
would make the held-out Peated record an indirect answer key. It would also
turn a missing year into a fact despite the submitted source not supporting it.

Age 6 and 56% ABV remain required. Only `releaseYear: 2024` was removed. No
classifier code or saved model output changed. Re-scoring the completed C13
focused outputs changes all three changed SMWS attempts from failures to
passes; all three comparison cases still fail because they omitted age and ABV.
