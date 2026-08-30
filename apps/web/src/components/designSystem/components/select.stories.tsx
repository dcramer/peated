import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Select } from "./formControls.stylex";

const options = (
  <>
    <option value="barrel">First-fill bourbon barrel</option>
    <option value="hogshead">Refill hogshead</option>
    <option value="sherry">Oloroso sherry butt</option>
  </>
);

const meta = {
  title: "Components/Forms/Select",
  component: Select,
  args: { children: options, defaultValue: "hogshead" },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Select {...args} />
      <Select defaultValue="hogshead" invalid>
        {options}
      </Select>
      <Select defaultValue="hogshead" disabled>
        {options}
      </Select>
    </StoryStack>
  ),
};
