import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TastingFormPattern } from "./tastingForm.stylex";

const meta = {
  title: "Components/Forms/Tasting Form",
  component: TastingFormPattern,
  args: {
    initialRating: null,
    submitting: false,
  },
} satisfies Meta<typeof TastingFormPattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Saving: Story = {
  args: {
    initialRating: "outstanding",
    submitting: true,
  },
};
