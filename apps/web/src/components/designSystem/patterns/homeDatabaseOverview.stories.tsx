import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { HomeDatabaseOverview } from "./homeSections.stylex";

const meta = {
  title: "Patterns/Home/Database Overview",
  component: HomeDatabaseOverview,
  args: {
    principles: [
      "Anyone can record a missing bottling, including its cask, vintage, strength, and finish.",
      "Critic scores stay attached to their published release, beside the community view rather than blended into it.",
      "Your tastings and library remain your record, and you can export them at any time.",
    ],
    record: {
      description:
        "The trade score stays in plain ink, the community verdict stays distinct, and the tastings beneath them preserve what each person actually recorded.",
      detail: "Islay · single malt",
      id: "B00872",
      specs: [
        { label: "ABV", value: "43.0" },
        { label: "Age", value: "16" },
        { label: "Critic", value: "88" },
        { label: "Savor", value: "62%" },
      ],
      title: "Lagavulin 16",
    },
  },
  argTypes: {
    principles: { control: false },
    record: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof HomeDatabaseOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
