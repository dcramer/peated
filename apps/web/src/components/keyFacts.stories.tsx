import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KeyFacts } from "./catalogDetails.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Catalog/Key Facts",
  component: KeyFacts,
  args: {
    facts: [
      { label: "Series", value: "Private Collection", text: true },
      { label: "ABV", value: "43%" },
      { label: "Age", value: "16 years" },
    ],
  },
  argTypes: { facts: { control: "object" } },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof KeyFacts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <KeyFacts {...args} />
      <KeyFacts
        facts={[
          { label: "ABV", value: "50%" },
          { label: "Age", value: null },
          { label: "Cask", value: "14300" },
        ]}
      />
    </StoryStack>
  ),
};
