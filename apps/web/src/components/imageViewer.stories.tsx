import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";

import { colors } from "../styles/tokens.stylex";
import { ImageViewer } from "./imageViewer.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const styles = stylex.create({
  frame: {
    width: "240px",
    height: "240px",
    backgroundColor: colors.imageBackground,
  },
  image: {
    display: "block",
    width: "100%",
    height: "auto",
  },
});

const meta = {
  title: "Components/Content/Image Viewer",
  component: ImageViewer,
  args: {
    alt: "A whisky bottle on a white background",
    label: "Whisky bottle",
    src: "/assets/auth-discovery-illustration.webp",
    imageProps: stylex.props(styles.image),
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <div {...stylex.props(styles.frame)}>
          <Story />
        </div>
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ImageViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
