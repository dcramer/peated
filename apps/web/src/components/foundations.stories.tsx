import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import Foundations from "./foundations.stylex";

const meta = {
  title: "Foundations",
  component: Foundations,
  args: { section: "color" },
  argTypes: { section: { table: { disable: true } } },
} satisfies Meta<typeof Foundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Color: Story = {};

export const Typography: Story = { args: { section: "typography" } };

export const GeometryAndSpacing: Story = { args: { section: "shape" } };
