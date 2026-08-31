import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KeyFacts } from "./catalogDetails.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Catalog/Key Facts",
  component: KeyFacts,
  args: {
    facts: [
      { label: "ABV", value: "43.0%" },
      { label: "Age", value: "16 years" },
      { label: "Cask", value: "ex-bourbon" },
      { label: "Size", value: "700 ml" },
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
          { label: "Founded", value: "1816" },
          { label: "Capacity", value: "2.4m L" },
          { label: "Bottlings", value: "148" },
        ]}
      />
      <KeyFacts
        facts={[
          { label: "ABV", value: "50.0%" },
          { label: "Age", value: null },
          { label: "Cask", value: null },
          { label: "Size", value: "700 ml" },
        ]}
      />
    </StoryStack>
  ),
};
