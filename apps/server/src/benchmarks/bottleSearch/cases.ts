import type { BottleCreateCandidateInput } from "../../lib/bottleCreateCandidates";
import reviewedCases from "./reviewed-cases.json";

// Public catalog IDs and reviewed source facts from the September 2026 queue.
// Expected IDs establish retrieval recall, not permission to approve a match.
export const searchCases: {
  name: string;
  proposal: number;
  split?: string;
  source?: string;
  expected: number;
  input: BottleCreateCandidateInput;
}[] = [
  {
    name: "generic age with known Brand",
    proposal: 15400,
    expected: 61142,
    input: {
      name: "30-year-old",
      brand: { id: 1353, name: "SPEY" },
      distillers: [{ id: 1356, name: "Speyside Distillery" }],
      statedAge: 30,
      abv: 46,
    },
  },
  {
    name: "Singleton age and producer",
    proposal: 15401,
    expected: 61162,
    input: {
      name: "38-year-old",
      brand: { id: 1426, name: "The Singleton of Glen Ord" },
      distillers: [{ id: 242, name: "Glen Ord" }],
      statedAge: 38,
      abv: 49.6,
    },
  },
  {
    name: "independent bottling with exact cask",
    proposal: 15398,
    expected: 56467,
    input: {
      name: "Benrinnes 1979",
      brand: { id: 5998, name: "Berry Bros. & Rudd" },
      distillers: [{ id: 89, name: "Benrinnes" }],
      vintageYear: 1979,
      caskNumber: "62",
      abv: 42.1,
    },
  },
  {
    name: "packaging wording on an existing expression",
    proposal: 15397,
    expected: 11865,
    input: {
      name: "Japanese Harmony Limited Edition",
      brand: { id: 1022, name: "Hibiki" },
      abv: 43,
    },
  },
  {
    name: "vintage with bottling year",
    proposal: 15394,
    expected: 57592,
    input: {
      name: "1988",
      brand: { id: 438, name: "Highland Park" },
      distillers: [{ id: 438, name: "Highland Park" }],
      vintageYear: 1988,
      bottlingYear: 2023,
      abv: 43.8,
    },
  },
  {
    name: "distinctive expression",
    proposal: 15399,
    expected: 61108,
    input: {
      name: "Timeless",
      brand: { id: 394, name: "Bowmore" },
      statedAge: 29,
      abv: 53.7,
    },
  },
  // SAFETY: Reviewed, checked-in Bottle inputs use valid category literals; JSON
  // inference widens those literals to string. Runtime benchmark inputs are local fixtures.
  ...(reviewedCases as {
    name: string;
    proposal: number;
    expected: number;
    split: string;
    source: string;
    input: BottleCreateCandidateInput;
  }[]),
];
