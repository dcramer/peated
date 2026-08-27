import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { SpecStrip } from "./dataDevices.stylex";

const meta = {
  title: "Components/Data Display/Spec Strip",
  component: SpecStrip,
  args: {
    cells: [
      { label: "ABV", value: "43.0%" },
      { label: "Age", value: "16 yr" },
      { label: "Cask", value: "ex-bourbon" },
      { label: "Size", value: "700 ml" },
    ],
  },
  argTypes: { cells: { control: "object" } },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SpecStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FourCells: Story = {};

export const ThreeCells: Story = {
  args: {
    cells: [
      { label: "Founded", value: "1816" },
      { label: "Capacity", value: "2.4m L" },
      { label: "Bottlings", value: "148" },
    ],
  },
};

export const ThinData: Story = {
  args: {
    cells: [
      { label: "ABV", value: "50.0%" },
      { label: "Age", value: null },
      { label: "Cask", value: null },
      { label: "Size", value: "700 ml" },
    ],
  },
};
