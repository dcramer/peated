import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { CollectionBottleStatusInput } from "./collectionBottleStatus.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Bottles/Collection Bottle Status",
  component: CollectionBottleStatusInput,
  args: {
    onChange: () => undefined,
    value: null,
  },
  argTypes: {
    value: { control: "select", options: [null, "sealed", "open", "empty"] },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CollectionBottleStatusInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <StatusExample key={args.value} {...args} />
      <CollectionBottleStatusInput {...args} value="open" />
      <CollectionBottleStatusInput {...args} value="empty" />
      <CollectionBottleStatusInput {...args} disabled value={null} />
    </StoryStack>
  ),
};

function StatusExample(
  props: React.ComponentProps<typeof CollectionBottleStatusInput>,
) {
  const [value, setValue] = useState(props.value);
  return (
    <CollectionBottleStatusInput {...props} onChange={setValue} value={value} />
  );
}
