import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Checkbox } from "./checkbox.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Forms/Checkbox",
  component: Checkbox,
  args: {
    label: "I agree to the Terms of Service.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Checkbox {...args} />
      <Checkbox defaultChecked label="Terms accepted" />
      <Checkbox
        description="You can change this later in account settings."
        label="Share tasting activity"
      />
      <Checkbox disabled label="Unavailable option" />
    </StoryStack>
  ),
};
