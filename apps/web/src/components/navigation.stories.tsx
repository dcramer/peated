import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NavigationTabs } from "./navigation.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const databaseItems = [
  { href: "/activity", label: "Activity" },
  { href: "/bottles", label: "Bottles" },
  { href: "/distillers", label: "Distillers" },
  { href: "/bottlers", label: "Bottlers" },
] as const;

const personalItems = [
  { href: "/library", label: "Library" },
  { href: "/tastings", label: "Tastings" },
  { href: "/following", label: "Following" },
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

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <NavigationTabs {...args} />
      <NavigationTabs {...args} personalItems={personalItems} />
      <NavigationTabs
        {...args}
        currentHref="/distillers"
        personalItems={personalItems}
      />
    </StoryStack>
  ),
};
