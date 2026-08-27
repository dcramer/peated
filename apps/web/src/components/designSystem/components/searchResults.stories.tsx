import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { SearchResultsPanel } from "./searchResults.stylex";
import { searchResultGroups } from "./storyData";

const meta = {
  title: "Components/Data Display/Search Results Panel",
  component: SearchResultsPanel,
  args: {
    activeId: "bottle-872",
    contribution: {
      description: "Not the bottle you have? Add it to the catalog.",
      href: "/addBottle?name=lagav",
      label: "Record a bottle",
    },
    groups: searchResultGroups,
    query: "lagav",
  },
  argTypes: {
    groups: { table: { disable: true } },
    onRetry: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SearchResultsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedResults: Story = {};

export const Loading: Story = {
  args: {
    activeId: undefined,
    contribution: undefined,
    groups: [],
    status: "searching",
    statusText: "Searching bottles, entities, and members…",
  },
};

export const NoResults: Story = {
  args: {
    activeId: undefined,
    emptyText:
      "Nothing matches “glenfarcls”. Check the spelling or record the bottle if it is missing.",
    groups: [],
    query: "glenfarcls",
  },
};

export const Unavailable: Story = {
  args: {
    onRetry: () => undefined,
    status: "error",
  },
};
