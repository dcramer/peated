import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { IdStamp } from "./dataDevices.stylex";

const meta = {
  title: "Components/Data Display/ID Stamp",
  component: IdStamp,
  args: { detail: "Islay · single malt", id: "№ 00872" },
} satisfies Meta<typeof IdStamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDetail: Story = { args: { detail: undefined } };
