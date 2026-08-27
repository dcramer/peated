import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DistilleryPagePattern } from "./distilleryPage.stylex";

const meta = {
  title: "Patterns/Distillery Page",
  component: DistilleryPagePattern,
} satisfies Meta<typeof DistilleryPagePattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
