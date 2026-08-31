import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CollectionBottleStatusChips } from "./collectionBottleStatus.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Bottles/Collection Bottle Status",
  component: CollectionBottleStatusChips,
  args: {
    onChange: () => undefined,
    value: "sealed",
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CollectionBottleStatusChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <CollectionBottleStatusChips {...args} value="sealed" />
      <CollectionBottleStatusChips {...args} value="open" />
      <CollectionBottleStatusChips {...args} value="empty" />
      <CollectionBottleStatusChips {...args} disabled value={null} />
    </StoryStack>
  ),
};
