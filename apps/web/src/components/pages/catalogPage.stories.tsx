import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";

const meta = {
  title: "Components/Pages/Catalog Page Loading",
  component: CatalogPageLoading,
  args: { title: "Bottles" },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CatalogPageLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const TextRowsWithNavigation: Story = {
  args: {
    action: false,
    navigation: true,
    title: "Following",
    variant: "entity",
  },
};
