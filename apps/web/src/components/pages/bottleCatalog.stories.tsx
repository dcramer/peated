"use client";

import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryCanvas } from "../storyFixtures.stylex";
import {
  BottleCatalogFilters,
  BottleCatalogList,
  BottleCatalogSearch,
} from "./bottleCatalog.stylex";
import { CatalogPage } from "./catalogPage.stylex";

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
          "Bottle search leads the results column on wide screens. On narrow screens it returns to the filter panel beside the filter toggle, while Category and Age statement remain discoverable.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => <BottleCatalogExample />,
};

function BottleCatalogExample() {
  const [filters, setFilters] = useState({
    ageBand: "",
    category: "",
    query: "",
  });

  function updateFilter(name: "ageBand" | "category", value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setFilters({ ageBand: "", category: "", query: "" });
  }

  return (
    <CatalogPage
      filters={
        <BottleCatalogFilters
          age=""
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
          onClear={clearFilters}
          onQuerySubmit={(query) =>
            setFilters((current) => ({ ...current, query }))
          }
          query={filters.query}
        />
      }
      title="Bottles"
    >
      <BottleCatalogList
        items={mockBottles
          .slice(0, 4)
          .map((bottle) => toBottleListItem(bottle, { includeRatings: true }))}
        onSortChange={() => undefined}
        page={1}
        search={
          <BottleCatalogSearch
            onSubmit={(query) =>
              setFilters((current) => ({ ...current, query }))
            }
            query={filters.query}
          />
        }
        sort="-release"
        sortOptions={[
          { label: "Latest release", value: "-release" },
          { label: "Highest score", value: "-score" },
        ]}
        total={mockBottles.length}
      />
    </CatalogPage>
  );
}
