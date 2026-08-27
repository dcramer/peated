import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { RecordTable, type RecordTableProps } from "./recordTable.stylex";
import { VerdictDistributionBar } from "./scoring.stylex";

const rows: RecordTableProps["rows"] = [
  {
    href: "/bottles/1",
    id: "1",
    metadata: "Islay · 10 years · 46% ABV",
    name: "Port Charlotte 10 Year Old",
    values: [
      "84.2",
      <VerdictDistributionBar key="verdict" pass={14} savor={51} sip={32} />,
    ],
  },
  {
    href: "/bottles/2",
    id: "2",
    metadata: "Islay · NAS · 54.2% ABV",
    name: "Ardbeg Uigeadail",
    values: [
      "88.7",
      <VerdictDistributionBar key="verdict" pass={9} savor={74} sip={29} />,
    ],
  },
  {
    href: "/bottles/3",
    id: "3",
    metadata: "Islay · 12 years · 43% ABV",
    name: "Caol Ila 12 Year Old",
    values: [
      null,
      <VerdictDistributionBar key="verdict" pass={0} savor={0} sip={0} />,
    ],
  },
];

const meta = {
  title: "Components/Data Display/Record Table",
  component: RecordTable,
  args: {
    columns: ["Community score", "Verdicts"],
    detail: "3 bottles in this set",
    heading: "Islay single malts",
    rows,
  },
  argTypes: { rows: { control: false } },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<RecordTableProps>;

export default meta;
type Story = StoryObj<RecordTableProps>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <RecordTable {...args} />
      <RecordTable
        {...args}
        ariaLabel="Associated bottles"
        detail={undefined}
        heading={undefined}
      />
      <RecordTable
        {...args}
        rows={[
          {
            href: "/bottles/4",
            id: "4",
            metadata: "Campbeltown · 15 years · 51.4% ABV",
            name: "A deliberately long independent bottling name that tests the aligned row",
            values: [
              "91.3",
              <VerdictDistributionBar
                key="verdict"
                pass={2}
                savor={21}
                sip={7}
              />,
            ],
          },
        ]}
      />
    </StoryStack>
  ),
};
