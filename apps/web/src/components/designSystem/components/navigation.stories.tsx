import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { NavigationTabs } from "./navigation.stylex";

const databaseItems = [
  { href: "/bottles", label: "Bottles" },
  { href: "/locations", label: "Locations" },
  { href: "/distillers", label: "Distillers" },
  { href: "/brands", label: "Brands" },
  { href: "/bottlers", label: "Bottlers" },
] as const;

const personalItems = [
  { href: "/library", label: "Library" },
  { href: "/tastings", label: "Tastings" },
  { href: "/friends", label: "Friends" },
] as const;

const meta = {
  title: "Components/Navigation/Navigation Tabs",
  component: NavigationTabs,
  args: {
    ariaLabel: "Database",
    currentHref: "/bottles",
    items: databaseItems,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof NavigationTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Database: Story = {};

export const WithPersonalDestinations: Story = {
  args: { personalItems },
};

export const AnotherCurrentDestination: Story = {
  args: { currentHref: "/distillers", personalItems },
};
