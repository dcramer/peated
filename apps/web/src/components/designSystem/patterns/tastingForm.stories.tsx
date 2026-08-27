import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TastingFormPattern } from "./tastingForm.stylex";

const meta = {
  title: "Patterns/Tasting Form",
  component: TastingFormPattern,
  args: {
    initialRatingSystem: "verdict",
    initialScore: null,
    initialVerdict: null,
    submitting: false,
  },
} satisfies Meta<typeof TastingFormPattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HundredPoint: Story = {
  args: {
    initialRatingSystem: "score",
    initialScore: 88,
  },
};

export const Saving: Story = {
  args: {
    initialVerdict: "savor",
    submitting: true,
  },
};
