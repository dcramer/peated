import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { FloatingPanel } from "./feedback.stylex";
import {
  StoryCanvas,
  StoryStack,
  StorySurfaceContent,
} from "./storyFixtures.stylex";

const meta = {
  title: "Components/Feedback/Floating Panel",
  component: FloatingPanel,
  args: {
    children: (
      <StorySurfaceContent>
        <strong {...stylex.props(foundationStyles.rowTitle)}>
          Port Charlotte 10
        </strong>
        <span {...stylex.props(foundationStyles.metadata)}>
          Islay · 10 years · 50.0% ABV
        </span>
      </StorySurfaceContent>
    ),
  },
  argTypes: { children: { table: { disable: true } } },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FloatingPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <FloatingPanel {...args} />
      <FloatingPanel>
        <StorySurfaceContent>
          <strong {...stylex.props(foundationStyles.rowTitle)}>Saved</strong>
          <span {...stylex.props(foundationStyles.metadata)}>
            Your tasting is now visible to friends.
          </span>
        </StorySurfaceContent>
      </FloatingPanel>
    </StoryStack>
  ),
};
