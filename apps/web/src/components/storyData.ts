import type { MemberPickerOption } from "./memberPicker.stylex";
import type { NotePickerOption } from "./notePicker.stylex";
import type { ProducerPickerOption } from "./producerPicker.stylex";
import type { SearchResultGroup } from "./searchResults.stylex";

export const distillerOptions = [
  {
    detail: "Islay · 412 bottles · part of Rémy Cointreau",
    id: "D00192",
    meta: "412 bottles",
    name: "Bruichladdich",
  },
  {
    detail: "Islay · 86 bottles · part of Rémy Cointreau",
    id: "D00193",
    meta: "86 bottles",
    name: "Bruichladdich (Port Charlotte)",
  },
  {
    detail: "Islay · 64 bottles · part of Rémy Cointreau",
    id: "D00481",
    meta: "64 bottles",
    name: "Bruichladdich (Octomore)",
  },
] as const satisfies readonly ProducerPickerOption[];

export const noteOptions = [
  { category: "Peaty", common: true, name: "Smoke", usageCount: 12880 },
  { category: "Peaty", common: true, name: "Sea salt", usageCount: 8720 },
  { category: "Peaty", common: true, name: "Iodine", usageCount: 7164 },
  { category: "Peaty", common: true, name: "Ash", usageCount: 6941 },
  { category: "Peaty", common: true, name: "Brine", usageCount: 5840 },
  { category: "Peaty", name: "Bonfire", usageCount: 4678 },
  { category: "Peaty", name: "Seaweed", usageCount: 4320 },
  { category: "Peaty", name: "Charred oak", usageCount: 1784 },
  { category: "Fruity", common: true, name: "Dried fig", usageCount: 4102 },
  { category: "Fruity", name: "Lemon peel", usageCount: 6288 },
  { category: "Fruity", name: "Green apple", usageCount: 8210 },
  { category: "Cereal", name: "Malted barley", usageCount: 5910 },
  { category: "Floral", name: "Heather", usageCount: 3870 },
  { category: "Winey", name: "Sherry", usageCount: 9214 },
  { category: "Woody", name: "Oak", usageCount: 11240 },
  { category: "Feinty", name: "Leather", usageCount: 4740 },
  { category: "Sulphury", name: "Matchstick", usageCount: 1930 },
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
        metadata: "Islay · 16 years · 43.0% ABV",
        title: "Lagavulin 16-year-old",
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
        metadata: "Islay · 12 years · 56.4% ABV",
        title: "Lagavulin 12 Cask Strength 2024",
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
        metadata: "Islay",
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
        visual: { fallback: "LF", label: "lagavfan avatar" },
      },
    ],
  },
] as const satisfies readonly SearchResultGroup[];
