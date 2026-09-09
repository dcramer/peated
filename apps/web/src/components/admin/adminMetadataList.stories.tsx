import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { AdminMetadataList } from "./adminContent.stylex";

const meta = {
  title: "Admin/Metadata List",
  component: AdminMetadataList,
  args: {
    items: ["78% described", "48% pictured", "26% with reviews"],
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof AdminMetadataList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
