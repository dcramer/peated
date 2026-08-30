"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  Button,
  FacetGroup,
  FilterPanel,
  FilterQuery,
  PageTabs,
} from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import { CatalogPage } from "./catalogPage.stylex";
import {
  EntityCatalogList,
  type EntityCatalogItem,
} from "./entityCatalog.stylex";

const initialItems = [
  {
    href: "/distillers/E0034",
    id: 34,
    isFollowing: true,
    metadata: ["E0034", "Distillery", "Islay, Scotland"],
    name: "Ardbeg",
    totalBottles: 284,
    totalTastings: 3187,
  },
  {
    href: "/brands/E0201",
    id: 201,
    isFollowing: false,
    metadata: ["E0201", "Brand", "Japan"],
    name: "Nikka",
    totalBottles: 146,
    totalTastings: 982,
  },
  {
    href: "/bottlers/E0312",
    id: 312,
    isFollowing: false,
    metadata: ["E0312", "Bottler", "London, England"],
    name: "Berry Bros. & Rudd",
    totalBottles: 417,
    totalTastings: 624,
  },
  {
    href: "/distillers/E0022",
    id: 22,
    isFollowing: true,
    metadata: ["E0022", "Distillery", "Islay, Scotland"],
    name: "Laphroaig",
    totalBottles: 231,
    totalTastings: 2741,
  },
] satisfies readonly EntityCatalogItem[];

const meta = {
  title: "Patterns/Following",
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FindMore: Story = {
  render: () => <FollowingScenario />,
};

function FollowingScenario() {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const visibleItems = items.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesType = !type || item.metadata[1]?.toLowerCase() === type;
    return matchesQuery && matchesType;
  });

  function clearFilters() {
    setQuery("");
    setType("");
  }

  function toggleFollowing(item: EntityCatalogItem) {
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, isFollowing: !candidate.isFollowing }
          : candidate,
      ),
    );
  }

  return (
    <CatalogPage
      eyebrow="Your record"
      filters={
        <FilterPanel ariaLabel="Following filters">
          <FilterQuery
            label="Name"
            onSubmit={setQuery}
            placeholder="Distiller, brand, or bottler"
            query={query}
          />
          <FacetGroup
            label="Type"
            onChange={setType}
            options={[
              { label: "Distillers", value: "distillery" },
              { label: "Brands", value: "brand" },
              { label: "Bottlers", value: "bottler" },
            ]}
            selected={type}
          />
          <Button align="start" onClick={clearFilters} size="sm" variant="text">
            Clear filters
          </Button>
        </FilterPanel>
      }
      navigation={
        <PageTabs
          ariaLabel="Following views"
          currentHref="/following?view=find"
          items={[
            { href: "/following", label: "Following" },
            { href: "/following?view=find", label: "Find more" },
          ]}
        />
      }
      title="Following"
    >
      <EntityCatalogList
        emptyDescription="Try a broader search or choose another type."
        emptyHeading="Nothing matches"
        items={visibleItems}
        noun="result"
        onClear={clearFilters}
        onSortChange={() => undefined}
        onToggleFollowing={toggleFollowing}
        page={1}
        showFollowingMarks
        sort="name"
        sortOptions={[
          { label: "Name", value: "name" },
          { label: "Most tasted", value: "-tastings" },
          { label: "Recently added", value: "-created" },
        ]}
      />
    </CatalogPage>
  );
}
