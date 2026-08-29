import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { Button } from "./button.stylex";
import { Field, TextInput } from "./field.stylex";
import { Switch } from "./formControls.stylex";
import {
  FormActions,
  FormDetails,
  FormGrid,
  FormNotice,
  FormSection,
  FormStack,
  OptionalField,
  OptionalFieldList,
} from "./formLayout.stylex";

const meta = {
  title: "Components/Forms/Form layout",
  component: FormSection,
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  args: {
    children: null,
    title: "Profile",
  },
  render: () => (
    <FormStack>
      <FormNotice>Your email address is waiting for verification.</FormNotice>
      <FormSection
        description="The name and picture shown beside your activity."
        title="Profile"
      >
        <Field htmlFor="form-layout-name" label="Username" required>
          <TextInput defaultValue="dramfriend" id="form-layout-name" />
        </Field>
        <Switch
          checked={false}
          description="Only friends can see your activity."
          label="Private profile"
          onCheckedChange={() => undefined}
        />
      </FormSection>
      <FormDetails
        description="Optional catalog and production information."
        title="More details"
      >
        <FormGrid>
          <Field htmlFor="form-layout-year" label="Release year" optional>
            <TextInput id="form-layout-year" placeholder="2026" />
          </Field>
          <Field htmlFor="form-layout-edition" label="Edition" optional>
            <TextInput id="form-layout-edition" placeholder="Batch 24" />
          </Field>
        </FormGrid>
      </FormDetails>
      <FormSection title="Optional fields">
        <OptionalFieldList>
          <div id="optional-field-hovered">
            <OptionalField label="Colour" summary="Unsure">
              <TextInput aria-label="Colour" placeholder="Choose a colour" />
            </OptionalField>
          </div>
          <div id="optional-field-focused">
            <OptionalField
              defaultOpen
              label="Comments"
              summary="Honey, smoke, and orange peel"
            >
              <TextInput
                aria-label="Comments"
                defaultValue="Honey, smoke, and orange peel"
              />
            </OptionalField>
          </div>
        </OptionalFieldList>
      </FormSection>
      <FormActions>
        <Button variant="accent">Save changes</Button>
      </FormActions>
    </FormStack>
  ),
  parameters: {
    pseudo: {
      focusVisible: ["#optional-field-focused summary"],
      hover: ["#optional-field-hovered summary"],
    },
  },
};
