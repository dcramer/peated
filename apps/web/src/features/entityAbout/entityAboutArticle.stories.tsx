import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  mockBrora,
  mockEntityAbouts,
  mockEntityVintageCounts,
} from "@peated/server/orpc/mock/fixtures";
import { StoryCanvas } from "../../components/storyFixtures.stylex";

import { getCitationNumbers, getKeyFacts } from "./entityAbout";
import {
  EntityAboutHistory,
  EntityAboutLead,
  EntityAboutSources,
  EntityAboutTimeline,
} from "./entityAboutArticle.stylex";

const broraAbout = mockEntityAbouts.get(mockBrora.id)!;
const citationNumbers = getCitationNumbers(
  broraAbout,
  getKeyFacts(broraAbout, mockBrora.name),
);

const meta = {
  title: "Components/History/About Article",
  component: EntityAboutHistory,
  args: {
    about: broraAbout,
    entity: mockBrora,
    counts: {
      vintages: mockEntityVintageCounts.get(mockBrora.id)!,
      releaseYears: { results: [], withoutYear: 0 },
    },
    citationNumbers,
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  render: (args) => (
    <>
      <EntityAboutLead
        about={args.about}
        citationNumbers={args.citationNumbers}
        lead={args.about.lead!}
      />
      <EntityAboutTimeline
        about={args.about}
        currentYear={2026}
        entityName={args.entity.name}
      />
      <EntityAboutHistory {...args} />
      <EntityAboutSources
        about={args.about}
        citationNumbers={args.citationNumbers}
      />
    </>
  ),
} satisfies Meta<typeof EntityAboutHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Brora's mock About parts in page order: lead, timeline, sections with
 * source notes and the rename disagreement, the vintage chart, and sources.
 * The Entity page places them around its catalog lists.
 */
export const Overview: Story = {};
