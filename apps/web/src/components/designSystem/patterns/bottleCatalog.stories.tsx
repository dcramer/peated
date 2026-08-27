import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import {
  BottleCatalogFilters,
  BottleCatalogList,
  BottleCatalogLoading,
  type BottleCatalogFacetGroup,
  type BottleCatalogFilterOption,
  type BottleCatalogItem,
} from "./bottleCatalog.stylex";

const items = [
  {
    averageScore: 91.2,
    brand: "Lagavulin",
    brandHref: "#lagavulin",
    hasTasted: true,
    href: "#lagavulin-16",
    id: "B00872",
    isLibrary: true,
    metadata: ["Single malt", "16 years", "43% ABV", "200 tastings"],
    name: "16-year-old",
    relatedReleases: { count: 3, href: "#lagavulin-releases" },
    totalScores: 184,
    verdicts: { pass: 12, savor: 142, sip: 46 },
  },
  {
    averageScore: 93,
    brand: "Ardbeg",
    brandHref: "#ardbeg",
    href: "#uigeadail",
    id: "B02141",
    metadata: ["Single malt", "NAS", "54.2% ABV", "115 tastings"],
    name: "Uigeadail",
    totalScores: 88,
    verdicts: { pass: 4, savor: 88, sip: 23 },
  },
  {
    averageScore: null,
    brand: "Càrn Mòr",
    brandHref: "#carn-mor",
    href: "#carn-mor-release",
    id: "B04198",
    metadata: ["Blended malt", "12 years", "48% ABV", "No tastings"],
    name: "Strictly Limited Highland 12-year-old",
    totalScores: 0,
    verdicts: { pass: 0, savor: 0, sip: 0 },
  },
] satisfies readonly BottleCatalogItem[];

const sortOptions = [
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Recently added", value: "-created" },
  { label: "Bottle name", value: "name" },
] as const;

const categoryOptions = [
  { label: "All categories", value: "" },
  { label: "Single malt", value: "single_malt" },
  { label: "Blended malt", value: "blended_malt" },
] satisfies readonly BottleCatalogFilterOption[];

const facetGroups = [
  {
    label: "Category",
    name: "category",
    options: [
      { count: 892, label: "Single malt", value: "single_malt" },
      { count: 314, label: "Blended malt", value: "blended_malt" },
      { count: 246, label: "Bourbon", value: "bourbon" },
      { count: 128, label: "Rye", value: "rye" },
    ],
  },
  {
    label: "Age statement",
    name: "ageBand",
    options: [
      { count: 518, label: "NAS", value: "nas" },
      { count: 286, label: "Under 12", value: "under_12" },
      { count: 392, label: "12–17 years", value: "12_17" },
      { count: 164, label: "18–24 years", value: "18_24" },
      { count: 97, label: "25+ years", value: "25_plus" },
    ],
  },
] satisfies readonly BottleCatalogFacetGroup[];

const meta = {
  title: "Patterns/Bottle Catalog",
  component: BottleCatalogList,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BottleCatalogList>;

export default meta;
type Story = StoryObj<typeof meta>;

function ResultsExample({ empty = false }: { empty?: boolean }) {
  const [sort, setSort] = useState("-tastings");

  return (
    <BottleCatalogList
      items={empty ? [] : items}
      nextHref={empty ? undefined : "#page-2"}
      onClear={() => undefined}
      onSortChange={setSort}
      page={1}
      sort={sort}
      sortOptions={sortOptions}
      total={empty ? 0 : 1832}
    />
  );
}

export const Results: Story = {
  args: {
    items,
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  render: () => <ResultsExample />,
};

export const Empty: Story = {
  args: {
    items: [],
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  render: () => <ResultsExample empty />,
};

export const Loading: Story = {
  args: {
    items: [],
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  render: () => <BottleCatalogLoading />,
};

function FiltersExample() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    age: "",
    category: "",
  });
  const [selectedFacets, setSelectedFacets] = useState({
    ageBand: "",
    category: "single_malt",
  });

  return (
    <BottleCatalogFilters
      {...filters}
      categoryOptions={categoryOptions}
      facets={{
        groups: facetGroups,
        onChange: (name, value) =>
          setSelectedFacets((current) => ({ ...current, [name]: value })),
        selected: selectedFacets,
        total: 1832,
      }}
      onChange={(name, value) =>
        setFilters((current) => ({ ...current, [name]: value }))
      }
      onClear={() => {
        setFilters({
          age: "",
          category: "",
        });
        setSelectedFacets({ ageBand: "", category: "" });
        setQuery("");
      }}
      onQuerySubmit={setQuery}
      query={query}
    />
  );
}

export const Filters: Story = {
  args: {
    items,
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  render: () => <FiltersExample />,
};
