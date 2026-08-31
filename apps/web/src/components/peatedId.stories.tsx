import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PeatedId } from "./catalogDetails.stylex";
import { StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Catalog/Peated ID",
  component: PeatedId,
  args: { detail: "Islay · single malt", id: "№ 00872" },
} satisfies Meta<typeof PeatedId>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <PeatedId {...args} />
      <PeatedId id="B00872" />
    </StoryStack>
  ),
};
