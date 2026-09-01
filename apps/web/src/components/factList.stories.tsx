import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FactList } from "./factList.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Lists & Tables/Fact List",
  component: FactList,
  args: {
    facts: [
      { label: "Phenols", value: null },
      { label: "Coloring", value: "E150a" },
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
      <FactList
        facts={[
          { label: "Category", value: "Single malt" },
          { label: "ABV", value: "58.8%" },
          { label: "Age", value: "11 years" },
          { label: "Cask", value: "First-fill ex-bourbon barrel" },
        ]}
        layout="grid"
      />
    </StoryStack>
  ),
};
