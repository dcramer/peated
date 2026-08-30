import type { Badge } from "@peated/server/types";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BadgeImage } from "./badgeImage.stylex";
import { StoryCanvas, StoryRow } from "./storyFixtures.stylex";

const badge: Badge = {
  id: 1,
  imageUrl: null,
  maxLevel: 25,
  name: "Islay",
};

const meta = {
  title: "Components/Identity/Badge Image",
  component: BadgeImage,
  args: {
    badge,
    level: 4,
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BadgeImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryRow>
      <BadgeImage {...args} size={48} />
      <BadgeImage {...args} level={badge.maxLevel} size={64} />
    </StoryRow>
  ),
};
