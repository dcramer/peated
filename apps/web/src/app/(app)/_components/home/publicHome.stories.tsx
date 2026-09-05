import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PublicHomeContentLoading } from "./publicHomeLayout.stylex";

const meta = {
  title: "Pages/Home",
  component: PublicHomeContentLoading,
  parameters: {
    docs: {
      description: {
        component:
          "The home loading state starts below the page heading and search. Its sections share their layout with the finished content.",
      },
    },
  },
} satisfies Meta<typeof PublicHomeContentLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
