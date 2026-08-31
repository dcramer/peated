import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TextInput } from "./field.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Forms/Text Input",
  component: TextInput,
  args: { placeholder: "Bottle name" },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <TextInput {...args} />
      <TextInput defaultValue="Lagavulin 16" />
      <TextInput defaultValue="43.0" format="data" inputMode="decimal" />
      <TextInput defaultValue="592" format="data" invalid />
      <TextInput defaultValue="Lagavulin 16" disabled />
    </StoryStack>
  ),
};
