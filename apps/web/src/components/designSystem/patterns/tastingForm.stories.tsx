import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TastingFormPattern } from "./tastingForm.stylex";

const meta = {
  title: "Components/Forms/Tasting Form",
  component: TastingFormPattern,
  args: {
    disabled: false,
    initialRating: null,
  },
} satisfies Meta<typeof TastingFormPattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
