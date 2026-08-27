import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import {
  EntityCatalogFilters,
  EntityCatalogList,
  EntityCatalogLoading,
  type EntityCatalogItem,
} from "./entityCatalog.stylex";

const items = [
  {
    href: "/entities/9201",
    id: "E9201",
    metadata: ["E9201", "Distillery", "Islay, Scotland"],
    name: "Lagavulin",
    totalBottles: 84,
    totalTastings: 1200,
  },
  {
    href: "/entities/9202",
    id: "E9202",
    metadata: ["E9202", "Distillery", "Speyside, Scotland"],
    name: "The Macallan",
    totalBottles: 190,
    totalTastings: 2100,
  },
  {
    href: "/entities/9204",
    id: "E9204",
    metadata: ["E9204", "Distillery", "Kentucky, United States"],
    name: "Buffalo Trace",
    totalBottles: 95,
    totalTastings: 1750,
  },
] satisfies readonly EntityCatalogItem[];

const sortOptions = [
  { label: "Most tasted", value: "-tastings" },
  { label: "Most bottles", value: "-bottles" },
  { label: "Name", value: "name" },
] as const;

const countries = [
  { label: "Scotland", value: "9401" },
  { label: "Ireland", value: "9402" },
  { label: "United States of America", value: "9403" },
  { label: "Japan", value: "9404" },
] as const;

const meta = {
  title: "Patterns/Entity Catalog",
  component: EntityCatalogList,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof EntityCatalogList>;

export default meta;
type Story = StoryObj<typeof meta>;

function ResultsExample({ empty = false }: { empty?: boolean }) {
  const [sort, setSort] = useState("-tastings");

  return (
    <EntityCatalogList
      addHref="/addEntity?type=distiller"
      items={empty ? [] : items}
      nextHref={empty ? undefined : "#page-2"}
      noun="distiller"
      onClear={empty ? () => undefined : undefined}
      onSortChange={setSort}
      page={1}
      sort={sort}
      sortOptions={sortOptions}
    />
  );
}

export const Results: Story = {
  args: {
    addHref: "/addEntity?type=distiller",
    items,
    noun: "distiller",
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  render: () => <ResultsExample />,
};

export const Empty: Story = {
  args: {
    addHref: "/addEntity?type=distiller",
    items: [],
    noun: "distiller",
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  render: () => <ResultsExample empty />,
};

export const Loading: Story = {
  args: {
    addHref: "/addEntity?type=distiller",
    items: [],
    noun: "distiller",
    onSortChange: () => undefined,
    page: 1,
    sort: "-tastings",
    sortOptions,
  },
  render: () => <EntityCatalogLoading title="Distillers" />,
};

function FiltersExample() {
  const [country, setCountry] = useState("9401");
  const [query, setQuery] = useState("");

  return (
    <EntityCatalogFilters
      countries={countries}
      country={country}
      onClear={() => {
        setCountry("");
        setQuery("");
      }}
      onCountryChange={setCountry}
      onQuerySubmit={setQuery}
      query={query}
      region="Islay"
      onRegionClear={() => undefined}
    />
  );
}

export const Filters: Story = {
  args: {
    addHref: "/addEntity?type=distiller",
    items,
    noun: "distiller",
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
