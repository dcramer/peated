import type { MockOutputs } from "../contract";
import { mockBottle } from "./bottles";
import {
  mockBuffaloTraceEntity,
  mockEntity,
  mockMacallanEntity,
  mockMidletonEntity,
  mockRedbreastEntity,
  mockSpringbankEntity,
  mockYamazakiEntity,
} from "./entities";
import { mockCountries, mockCountry, mockRegion, mockRegions } from "./places";

export const mockUserRegionList = {
  results: [
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: { name: mockRegion.name, slug: mockRegion.slug },
      count: 15,
    },
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: {
        name: mockRegions[1]!.name,
        slug: mockRegions[1]!.slug,
      },
      count: 8,
    },
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: {
        name: mockRegions[3]!.name,
        slug: mockRegions[3]!.slug,
      },
      count: 6,
    },
    {
      country: {
        name: mockCountries[2]!.name,
        slug: mockCountries[2]!.slug,
      },
      region: {
        name: mockRegions[4]!.name,
        slug: mockRegions[4]!.slug,
      },
      count: 7,
    },
    {
      country: {
        name: mockCountries[3]!.name,
        slug: mockCountries[3]!.slug,
      },
      region: null,
      count: 4,
    },
  ],
  totalCount: 42,
} satisfies MockOutputs["users"]["regionList"];

export const mockUserFlavorList = {
  results: [
    { flavorProfile: "peated", count: 11, topBandCount: 7 },
    { flavorProfile: "deep_rich_dried_fruit", count: 8, topBandCount: 5 },
    { flavorProfile: "oily_coastal", count: 6, topBandCount: 4 },
    { flavorProfile: "juicy_oak_vanilla", count: 6, topBandCount: 3 },
    { flavorProfile: "spicy_sweet", count: 5, topBandCount: 2 },
    { flavorProfile: "light_delicate", count: 3, topBandCount: 1 },
  ],
  totalTopBandCount: 22,
  totalCount: 42,
} satisfies MockOutputs["users"]["flavorList"];

export const mockAgeStats = {
  knownCount: 36,
  median: 16,
  oldest: 25,
  buckets: [
    { id: "under10", label: "Under 10", count: 4 },
    { id: "from10To12", label: "10–12", count: 8 },
    { id: "from13To17", label: "13–17", count: 18 },
    { id: "from18To24", label: "18–24", count: 4 },
    { id: "atLeast25", label: "25+", count: 2 },
    { id: "unstated", label: "Unstated", count: 6 },
  ],
} satisfies MockOutputs["users"]["tastingStats"]["age"];

export const mockUserTastingStats = {
  total: 42,
  uniqueBottles: 31,
  bands: {
    total: 42,
    mediocre: 2,
    good: 8,
    very_good: 10,
    outstanding: 15,
    unicorn: 7,
  },
  mostTastedBottle: {
    id: mockBottle.id,
    name: mockBottle.fullName,
    count: 3,
  },
  age: mockAgeStats,
} satisfies MockOutputs["users"]["tastingStats"];

export const mockUserLibraryStats = {
  total: 12,
  status: {
    open: 4,
    sealed: 8,
    unspecified: 0,
  },
  brands: [
    { id: mockEntity.id, name: mockEntity.name, count: 3 },
    { id: mockMacallanEntity.id, name: mockMacallanEntity.name, count: 2 },
    {
      id: mockSpringbankEntity.id,
      name: mockSpringbankEntity.name,
      count: 2,
    },
    {
      id: mockRedbreastEntity.id,
      name: mockRedbreastEntity.name,
      count: 2,
    },
    {
      id: mockBuffaloTraceEntity.id,
      name: mockBuffaloTraceEntity.name,
      count: 1,
    },
    { id: mockYamazakiEntity.id, name: mockYamazakiEntity.name, count: 2 },
  ],
  distillers: [
    { id: mockEntity.id, name: mockEntity.name, count: 3 },
    { id: mockMacallanEntity.id, name: mockMacallanEntity.name, count: 2 },
    {
      id: mockSpringbankEntity.id,
      name: mockSpringbankEntity.name,
      count: 2,
    },
    { id: mockMidletonEntity.id, name: mockMidletonEntity.name, count: 2 },
    {
      id: mockBuffaloTraceEntity.id,
      name: mockBuffaloTraceEntity.name,
      count: 1,
    },
    { id: mockYamazakiEntity.id, name: mockYamazakiEntity.name, count: 2 },
  ],
  age: {
    ...mockAgeStats,
    knownCount: 12,
    buckets: [
      { id: "under10", label: "Under 10", count: 0 },
      { id: "from10To12", label: "10–12", count: 0 },
      { id: "from13To17", label: "13–17", count: 12 },
      { id: "from18To24", label: "18–24", count: 0 },
      { id: "atLeast25", label: "25+", count: 0 },
      { id: "unstated", label: "Unstated", count: 0 },
    ],
  },
  categories: [
    { category: "single_malt", count: 8 },
    { category: "single_pot_still", count: 2 },
    { category: "bourbon", count: 1 },
    { category: "blend", count: 1 },
  ],
} satisfies MockOutputs["users"]["libraryStats"];
