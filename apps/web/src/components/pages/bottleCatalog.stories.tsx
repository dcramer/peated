"use client";

import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import { BottleCatalogFacets, BottleCatalogList } from "./bottleCatalog.stylex";
import { CatalogPage, CatalogPageLoading } from "./catalogPage.stylex";

const meta = {
  title: "Pages/Bottle Catalog",
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Search, filters, sorting, rows, empty results, and paging share one table layout. Phone widths move all controls into one accessible panel.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  render: () => <BottleCatalogExample />,
};

export const MobileControls: Story = {
  globals: {
    viewport: { isRotated: false, value: "peatedPhone" },
  },
  render: () => <BottleCatalogExample />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Search, filters, and sort" }),
    );
  },
};

export const ActiveFilters: Story = {
  globals: {
    viewport: { isRotated: false, value: "peatedPhone" },
  },
  render: () => (
    <BottleCatalogExample
      initialFilters={{ ageBand: "18_24", category: "", query: "Islay" }}
    />
  ),
};

export const Empty: Story = {
  render: () => <BottleCatalogExample empty />,
};

export const Loading: Story = {
  render: () => <CatalogPageLoading title="Bottles" />,
};

export const MobileLoading: Story = {
  globals: {
    viewport: { isRotated: false, value: "peatedPhone" },
  },
  render: () => <CatalogPageLoading title="Bottles" />,
};

export const Paginated: Story = {
  render: () => <BottleCatalogExample pagination />,
};

export const LongContent: Story = {
  render: () => <BottleCatalogExample longContent />,
};

type BottleFilters = {
  ageBand: string;
  category: string;
  query: string;
};

function BottleCatalogExample({
  empty = false,
  initialFilters = { ageBand: "", category: "", query: "" },
  longContent = false,
  pagination = false,
}: {
  empty?: boolean;
  initialFilters?: BottleFilters;
  longContent?: boolean;
  pagination?: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState("-release");

  function updateFilter(name: "ageBand" | "category", value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setFilters({ ageBand: "", category: "", query: "" });
  }

  const items = empty
    ? []
    : mockBottles.slice(0, 4).map((bottle, index) => ({
        ...toBottleListItem(bottle, { includeRatings: true }),
        name:
          longContent && index === 0
            ? "A very long single malt bottle name with a cask finish, vintage, bottling year, and release details"
            : bottle.name,
      }));

  return (
    <CatalogPage title="Bottles">
      <BottleCatalogList
        activeFilterCount={Object.values(filters).filter(Boolean).length}
        filters={
          <BottleCatalogFacets
            ageBand={filters.ageBand}
            ageBandOptions={[
              { label: "NAS", value: "nas" },
              { label: "12–17 years", value: "12_17" },
              { label: "18–24 years", value: "18_24" },
            ]}
            category={filters.category}
            categoryOptions={[
              { label: "Single malt", value: "single_malt" },
              { label: "Blended malt", value: "blended_malt" },
              { label: "Bourbon", value: "bourbon" },
            ]}
            onChange={updateFilter}
          />
        }
        items={items}
        nextHref={pagination ? "/bottles?cursor=2" : undefined}
        onClear={clearFilters}
        onSortChange={setSort}
        page={1}
        query={{
          label: "Find a bottle",
          onSubmit: (query) => setFilters((current) => ({ ...current, query })),
          placeholder: "Name, brand, or release",
          query: filters.query,
        }}
        sort={sort}
        sortOptions={[
          { label: "Latest release", value: "-release" },
          { label: "Highest score", value: "-score" },
        ]}
        total={empty ? 0 : mockBottles.length}
      />
    </CatalogPage>
  );
}
