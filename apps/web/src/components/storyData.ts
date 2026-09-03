import type { EntityPickerOption } from "./entityPicker.stylex";
import type { MemberPickerOption } from "./memberPicker.stylex";
import type { NotePickerOption } from "./notePicker.stylex";
import type { SearchResultGroup } from "./searchResults.stylex";

export const distillerOptions = [
  {
    id: "D00192",
    name: "Bruichladdich",
    kind: "distillery",
    location: "Islay, Scotland",
  },
  {
    id: "D00193",
    name: "Bruichladdich (Port Charlotte)",
    kind: "distillery",
    location: "Islay, Scotland",
  },
  {
    id: "D00481",
    name: "Bruichladdich (Octomore)",
    kind: "distillery",
    location: "Islay, Scotland",
  },
] as const satisfies readonly EntityPickerOption[];

export const noteOptions = [
  { category: "Smoke", common: true, name: "Smoke", usageCount: 12880 },
  { category: "Smoke", common: true, name: "Sea salt", usageCount: 8720 },
  { category: "Smoke", common: true, name: "Iodine", usageCount: 7164 },
  { category: "Smoke", common: true, name: "Ash", usageCount: 6941 },
  { category: "Smoke", common: true, name: "Brine", usageCount: 5840 },
  { category: "Smoke", name: "Bonfire", usageCount: 4678 },
  { category: "Smoke", name: "Seaweed", usageCount: 4320 },
  { category: "Wood", name: "Charred oak", usageCount: 1784 },
  { category: "Fruit", common: true, name: "Dried fig", usageCount: 4102 },
  { category: "Fruit", name: "Lemon peel", usageCount: 6288 },
  { category: "Fruit", name: "Green apple", usageCount: 8210 },
  { category: "Cereal", name: "Malted barley", usageCount: 5910 },
  { category: "Floral", name: "Heather", usageCount: 3870 },
  { category: "Wood", name: "Sherry", usageCount: 9214 },
  { category: "Wood", name: "Oak", usageCount: 11240 },
  { category: "Earthy", name: "Leather", usageCount: 4740 },
  { category: "Sulfur", name: "Matchstick", usageCount: 1930 },
] as const satisfies readonly NotePickerOption[];

export const memberOptions = [
  { detail: "Following since 2021", id: 1, username: "j.macleod" },
  { detail: "Following since 2023", id: 2, username: "marta" },
  { detail: "Following since 2024", id: 3, username: "stillroom" },
] as const satisfies readonly MemberPickerOption[];

export const searchResultGroups = [
  {
    id: "bottles",
    label: "Bottles",
    total: 42,
    moreHref: "/search?q=lagav&type=bottles",
    items: [
      {
        href: "/bottles/872",
        id: "bottle-872",
        ratings: {
          bands: {
            good: 8,
            mediocre: 3,
            outstanding: 19,
            unicorn: 6,
            very_good: 12,
          },
          score: { count: 48, value: 88 },
        },
        bottle: {
          provenance: [{ name: "Single Malt" }],
          metadata: ["16 years", "43.0% ABV"],
        },
        title: "Lagavulin 16-year-old",
        visual: { kind: "bottle", label: "Lagavulin 16-year-old bottle" },
      },
      {
        href: "/bottles/1188",
        id: "bottle-1188",
        ratings: {
          bands: {
            good: 3,
            mediocre: 1,
            outstanding: 8,
            unicorn: 2,
            very_good: 4,
          },
          score: { count: 26, value: 91 },
        },
        bottle: {
          provenance: [{ name: "Single Malt" }],
          metadata: ["2024 release", "12 years", "56.4% ABV"],
        },
        title: "Lagavulin 12 Cask Strength 2024",
        visual: { kind: "bottle", label: "Lagavulin 12 Cask Strength bottle" },
      },
    ],
  },
  {
    id: "distillers",
    label: "Distillers",
    total: 1,
    items: [
      {
        href: "/entities/245",
        id: "entity-245",
        entity: { kind: "distillery", location: "Islay, Scotland" },
        title: "Lagavulin",
      },
    ],
  },
  {
    id: "members",
    label: "Members",
    total: 2,
    items: [
      {
        href: "/users/lagavfan",
        id: "member-lagavfan",
        metadata: "412 tastings",
        title: "lagavfan",
        visual: { kind: "avatar", fallback: "LF", label: "lagavfan avatar" },
      },
    ],
  },
] as const satisfies readonly SearchResultGroup[];
