export type ScopePrecheckEvalCase = {
  name: string;
  source: "auction lot" | "store listing" | "review";
  /** The source title exactly as Peated stored it. */
  title: string;
  /**
   * `ignore`: the pre-check must ignore it. `keep`: it is one whisky Bottle,
   * so the pre-check must leave it to the agent.
   */
  expected: "ignore" | "keep";
};

// Real titles from production, 2026-11-03. Ignore cases are lots and listings
// a moderator ignored or that are plainly out of scope; keep cases are
// matched Bottles, including ones the decision model has scored as another
// drink, a set, merchandise, or a hand-fill. Answers that sit near a cutoff,
// such as a cream liqueur at 0.82-0.94, are left out so the check is stable.
export const SCOPE_PRECHECK_EVAL_CASES: ScopePrecheckEvalCase[] = [
  {
    name: "Deanston distillery hand-fill",
    source: "auction lot",
    title: "Deanston 2013 7 Year Old Hand Filled",
    expected: "ignore",
  },
  {
    name: "Kilkerran distillery hand-fill",
    source: "auction lot",
    title: "Kilkerran Hand Filled Distillery Exclusive",
    expected: "ignore",
  },
  {
    name: "GlenDronach hand-filled cask",
    source: "auction lot",
    title: "GlenDronach 2005 Hand Filled Cask #1444",
    expected: "ignore",
  },
  {
    name: "Bunnahabhain hand-filled cask",
    source: "auction lot",
    title: "Bunnahabhain 15 Year Old Hand Filled Cask #300072",
    expected: "ignore",
  },
  {
    name: "duty-paid trade sample",
    source: "auction lot",
    title: "Kilkerran 2011 13 Year Old Duty Paid Sample",
    expected: "ignore",
  },
  {
    name: "50 ml miniature",
    source: "store listing",
    title: "Macallan 12-year-old pre-2018 Miniature 50ml",
    expected: "ignore",
  },
  {
    name: "50 ml shot bottle",
    source: "store listing",
    title: "Johnnie Walker Blue Label Shot 50ml",
    expected: "ignore",
  },
  {
    name: "honey-flavored whiskey",
    source: "store listing",
    title: "Jack Daniel's Honey",
    expected: "ignore",
  },
  {
    name: "vanilla-flavored bourbon",
    source: "store listing",
    title: "Jim Beam Vanilla Bourbon",
    expected: "ignore",
  },
  {
    name: "plain single malt",
    source: "auction lot",
    title: "Lagavulin 16 Year Old",
    expected: "keep",
  },
  {
    name: "whisky finished in port casks",
    source: "auction lot",
    title: "Longrow 11 Year Old Red Tawny Port",
    expected: "keep",
  },
  {
    name: "whisky finished in rum casks",
    source: "store listing",
    title: "Smokehead Rum Rebel",
    expected: "keep",
  },
  {
    name: "whiskey finished in wine casks",
    source: "store listing",
    title: "Green Spot Chateau Montelena Zinfandel Cask Finish",
    expected: "keep",
  },
  {
    name: "whisky finished in sherry casks",
    source: "store listing",
    title: "Tomatin Cuatro Series 12-year-old Manzanilla 2/4",
    expected: "keep",
  },
  {
    name: "whisky with an anime label",
    source: "auction lot",
    title: "Togouchi Toei Animation Saint Seiya",
    expected: "keep",
  },
  {
    name: "whiskey named for cigars",
    source: "review",
    title: "Still Austin Tanager Cigar Blend",
    expected: "keep",
  },
  {
    name: "marketed release named Valinch",
    source: "auction lot",
    title: "Auchentoshan Valinch 2012 Release",
    expected: "keep",
  },
  {
    name: "producer-bottled distillery exclusive",
    source: "auction lot",
    title:
      "Octomore 10 Year Old Distillery Exclusive Limited Edition Release 2021",
    expected: "keep",
  },
  {
    name: "festival distillery exclusive",
    source: "auction lot",
    title: "Bowmore 15 Year Old Distillery Exclusive Feis Ile 2019",
    expected: "keep",
  },
  {
    name: "small open day bottle",
    source: "auction lot",
    title: "Springbank 10 Year Old Open Day 2025 35cl",
    expected: "keep",
  },
  {
    name: "distillery shop batch",
    source: "auction lot",
    title: "Glengoyne Tea Pot Dram Batch #5",
    expected: "keep",
  },
];
