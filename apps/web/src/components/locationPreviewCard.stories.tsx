import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LocationPreviewCard } from "./locationPreviewCard.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Places/Location Preview Card",
  component: LocationPreviewCard,
  args: {
    description:
      "An island region known for smoky single malt whisky and long-running distilleries.",
    href: "#islay",
    name: "Islay",
    totalBottles: 680,
    visual: { kind: "country", slug: "scotland" },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LocationPreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
