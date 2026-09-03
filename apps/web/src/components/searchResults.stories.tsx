import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SearchResults } from "./searchResults.stylex";
import { searchResultGroups } from "./storyData";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Search/Search Results",
  component: SearchResults,
  parameters: {
    docs: {
      description: {
        component:
          "Use for both global search and database results. Bottle results require identity from getBottleIdentityProps and render BottleIdentityRow. Typeahead results use quiet group labels, compact titles, and inline links to see all matches. Database results retain page headings. Other results may show an Avatar or initial. Include real images and missing-image results when reviewing a change.",
      },
    },
  },
  args: {
    activeId: "bottle-872",
    contribution: {
      description: "Not the bottle you have? Add it to the catalog.",
      href: "/bottles/new?name=lagav&returnAction=catalog",
      label: "Add a bottle",
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
} satisfies Meta<typeof SearchResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Loading: Story = {
  args: {
    activeId: undefined,
    contribution: undefined,
    groups: [],
    status: "searching",
    statusText: "Searching bottles, brands, producers, and members…",
  },
};

export const NoResults: Story = {
  args: {
    activeId: undefined,
    emptyText:
      "Nothing matches “glenfarcls”. Check the spelling or add the bottle if it is missing.",
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
