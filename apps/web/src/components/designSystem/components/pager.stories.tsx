import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Pager } from "./pager.stylex";

const meta = {
  title: "Components/Navigation/Pager",
  component: Pager,
  args: {
    currentPage: 1,
    filterLabel: "Islay",
    getPageHref: (page) => `?page=${page}`,
    rangeEnd: 6,
    rangeStart: 1,
    totalCount: 52,
    totalPages: 9,
  },
  argTypes: {
    getPageHref: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Pager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <Pager {...args} />
      <Pager {...args} currentPage={5} rangeEnd={30} rangeStart={25} />
      <Pager {...args} currentPage={9} rangeEnd={52} rangeStart={49} />
      <Pager
        {...args}
        filterLabel={undefined}
        rangeEnd={12}
        rangeStart={1}
        totalCount={12}
        totalPages={2}
      />
    </StoryStack>
  ),
};
