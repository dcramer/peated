import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { PageTabs } from "./pageTabs.stylex";

const items = [
  { href: "/bottles/19936", label: "Overview" },
  { count: 412, href: "/bottles/19936/tastings", label: "Tastings" },
  { href: "/bottles/19936/prices", label: "Prices" },
  { count: 3, href: "/bottles/19936/releases", label: "Releases" },
] as const;

const meta = {
  title: "Components/Navigation/Page Tabs",
  component: PageTabs,
  args: {
    ariaLabel: "Bottle pages",
    currentHref: "/bottles/19936",
    items,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof PageTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Tastings: Story = {
  args: { currentHref: "/bottles/19936/tastings" },
};
