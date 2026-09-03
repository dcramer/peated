import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { SelectedBottleSummary } from "./selectedBottleSummary.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Bottles/Selected Bottle Summary",
  component: SelectedBottleSummary,
  args: {
    bottle: mockBottle,
    imageUrl: BottleImage.src,
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
        bottle={{
          ...mockBottle,
          brand: {
            ...mockBottle.brand,
            name: "Bruichladdich",
            shortName: null,
          },
          name: "Octomore Edition 15.3 Islay Barley Super Heavily Peated",
          group: null,
          statedAge: null,
          noAgeStatement: true,
          abv: 61.5,
          imageUrl: null,
        }}
        imageUrl={null}
      />
    </StoryStack>
  ),
};
