import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryStack } from "../storyFixtures.stylex";
import { RecordId } from "./dataDevices.stylex";

const meta = {
  title: "Components/Data Display/Record ID",
  component: RecordId,
  args: { detail: "Islay · single malt", id: "№ 00872" },
} satisfies Meta<typeof RecordId>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <RecordId {...args} />
      <RecordId id="B00872" />
    </StoryStack>
  ),
};
