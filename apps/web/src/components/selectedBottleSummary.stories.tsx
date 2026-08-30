import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { SelectedBottleSummary } from "./selectedBottleSummary.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Data Display/Selected Bottle Summary",
  component: SelectedBottleSummary,
  args: {
    bottleId: "B00872",
    imageUrl: BottleImage.src,
    metadata: "Islay · 16 years · 43.0% ABV · ex-bourbon",
    name: "Lagavulin 16",
    onChange: () => undefined,
  },
  argTypes: {
    onChange: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SelectedBottleSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <SelectedBottleSummary {...args} />
      <SelectedBottleSummary {...args} onChange={undefined} />
      <SelectedBottleSummary
        bottleId="B104281"
        imageUrl={null}
        metadata="Islay · No age statement · 61.5% ABV · oloroso and bourbon casks"
        name="Octomore Edition 15.3 Islay Barley Super Heavily Peated"
      />
    </StoryStack>
  ),
};
