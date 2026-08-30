"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { SearchBox } from "../searchBox.stylex";
import { searchResultGroups } from "../storyData";
import { StoryCanvas } from "../storyFixtures.stylex";

const scopes = [
  { count: 232808, label: "Everything", value: "everything" },
  { count: 184204, label: "Bottles", value: "bottles" },
  { count: 3102, label: "Distillers", value: "distillers" },
  { count: 1412, label: "Brands", value: "brands" },
  { count: 288, label: "Bottlers", value: "bottlers" },
  { count: 48204, label: "Members", value: "members" },
] as const;

const meta = {
  title: "Components/Search/Search Box",
  component: SearchBox,
  args: {
    contribution: {
      description: "Not the bottle you have? Add it to the catalog.",
      href: "/bottles/new?name=lagav&returnAction=catalog",
      label: "Add a bottle",
    },
    defaultOpen: true,
    groups: searchResultGroups,
    onQueryChange: () => undefined,
    onResultSelect: () => undefined,
    onScopeChange: () => undefined,
    onSubmit: () => undefined,
    query: "lagav",
    scope: "everything",
    scopes,
  },
  argTypes: {
    groups: { table: { disable: true } },
    onQueryChange: { control: false },
    onResultSelect: { control: false },
    onRetry: { control: false },
    onScopeChange: { control: false },
    onSubmit: { control: false },
    scopes: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  render: (args) => <ControlledSearch {...args} />,
} satisfies Meta<typeof SearchBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {};

export const Searching: Story = {
  args: {
    status: "searching",
    statusText: "Searching bottles, entities, and members…",
  },
};

export const Debouncing: Story = {
  args: {
    contribution: undefined,
    groups: [],
    status: "ready",
  },
};

export const Loading: Story = {
  args: {
    contribution: undefined,
    groups: [],
    status: "searching",
    statusText: "Searching bottles, entities, and members…",
  },
};

export const SearchingAfterNoResults: Story = {
  args: {
    emptyText: "No records match “glenfarcls”.",
    groups: [],
    query: "glenfarclse",
    status: "searching",
    statusText: "Searching bottles, entities, and members…",
  },
};

export const NoResults: Story = {
  args: {
    emptyText:
      "Nothing matches “glenfarcls”. Check the spelling or add the bottle if it is missing.",
    groups: [],
    query: "glenfarcls",
  },
};

export const NearestMatch: Story = {
  args: {
    emptyText: "No exact records match “lagavulinn”.",
    groups: [
      {
        id: "nearest",
        items: [searchResultGroups[1].items[0]],
        label: "Did you mean?",
      },
    ],
    query: "lagavulinn",
  },
};

export const ExactMatch: Story = {
  args: {
    contribution: undefined,
    groups: [
      {
        id: "exact",
        items: [searchResultGroups[0].items[0]],
        label: "Exact match",
        total: 1,
      },
    ],
    query: "B0872",
  },
};

export const Unavailable: Story = {
  args: {
    onRetry: () => undefined,
    status: "error",
  },
};

function ControlledSearch(props: React.ComponentProps<typeof SearchBox>) {
  const [query, setQuery] = useState(props.query);
  const [scope, setScope] = useState(props.scope);

  return (
    <SearchBox
      {...props}
      onQueryChange={setQuery}
      onResultSelect={(item) => setQuery(item.title)}
      onScopeChange={setScope}
      query={query}
      scope={scope}
    />
  );
}
