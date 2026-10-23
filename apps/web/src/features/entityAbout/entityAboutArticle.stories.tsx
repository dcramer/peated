import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  mockBrora,
  mockEntityAbouts,
  mockEntityBottlerCounts,
  mockEntityVintageCounts,
} from "@peated/server/orpc/mock/fixtures";
import { StoryCanvas } from "../../components/storyFixtures.stylex";

import { getCitationNumbers, getKeyFacts } from "./entityAbout";
import { EntityAboutArticle } from "./entityAboutArticle.stylex";

const broraAbout = mockEntityAbouts.get(mockBrora.id)!;

const meta = {
  title: "Components/History/About Article",
  component: EntityAboutArticle,
  args: {
    about: broraAbout,
    entity: mockBrora,
    counts: {
      vintages: mockEntityVintageCounts.get(mockBrora.id)!,
      bottlers: mockEntityBottlerCounts.get(mockBrora.id)!,
      distillers: { results: [], withoutEntity: 0 },
      releaseYears: { results: [], withoutYear: 0 },
    },
    citationNumbers: getCitationNumbers(
      broraAbout,
      getKeyFacts(broraAbout, mockBrora.name),
    ),
    currentYear: 2026,
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof EntityAboutArticle>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Brora's mock article: timeline, sections with source notes, the rename
 * disagreement, the vintage chart, and the bottler list.
 */
export const Overview: Story = {};
