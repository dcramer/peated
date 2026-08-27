import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TastingFormPattern } from "./tastingForm.stylex";

const meta = {
  title: "Patterns/Tasting Form",
  component: TastingFormPattern,
  args: {
    initialGrain: "band",
    initialRating: null,
    submitting: false,
  },
} satisfies Meta<typeof TastingFormPattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ExactPoint: Story = {
  args: {
    initialGrain: "point",
    initialRating: { grain: "point", point: 88 },
  },
};

export const Saving: Story = {
  args: {
    initialRating: { band: "outstanding", grain: "band" },
    submitting: true,
  },
};
