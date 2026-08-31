import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FactList } from "./factList.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Lists & Tables/Fact List",
  component: FactList,
  args: {
    facts: [
      { label: "Phenols", value: null },
      { label: "Colouring", value: "E150a" },
      { label: "Filtration", value: "Chill filtered" },
      { label: "Bottling", value: "Official" },
    ],
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FactList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <FactList {...args} />
      <FactList
        facts={[
          { label: "Distilled at", value: "Bruichladdich Distillery" },
          {
            label: "Cask",
            value:
              "First-fill ex-bourbon hogshead with a long label description",
          },
        ]}
      />
    </StoryStack>
  ),
};
