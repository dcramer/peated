"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import type { MemberPickerOption, RatingBand } from "../components";
import {
  ColourInput,
  Field,
  FieldGroup,
  FormSection,
  FormStack,
  MemberPicker,
  NotePickerField,
  PictureInput,
  RatingBandInput,
  Select,
  SelectedBottleSummary,
  Textarea,
} from "../components";
import { memberOptions, noteOptions } from "../components/storyData";

export type TastingFormPatternProps = {
  disabled?: boolean;
  initialRating?: RatingBand | null;
};

/** Shows the reusable tasting fields without the route-owned workflow header. */
export function TastingFormPattern({
  disabled = false,
  initialRating = null,
}: TastingFormPatternProps) {
  const [rating, setRating] = useState<RatingBand | null>(initialRating);
  const [colour, setColour] = useState<number | null>(10);
  const [comments, setComments] = useState("");
  const [friends, setFriends] = useState<readonly MemberPickerOption[]>([]);
  const [notes, setNotes] = useState<readonly string[]>([]);
  const [serving, setServing] = useState("");

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      {...stylex.props(styles.form)}
    >
      <fieldset disabled={disabled} {...stylex.props(styles.fields)}>
        <FormStack>
          <SelectedBottleSummary
            bottleId="B00872"
            metadata="Islay · 16 yr · 43.0% · ex-bourbon"
            name="Lagavulin 16"
          />
          <FormSection title="Rating">
            <RatingBandInput
              disabled={disabled}
              id="tasting-rating"
              label="How was it"
              name="tasting-rating"
              onChange={setRating}
              value={rating}
            />
          </FormSection>
          <FormSection title="Tasting notes">
            <FieldGroup label="Flavours and aromas" optional>
              <NotePickerField
                notes={noteOptions}
                onChange={setNotes}
                value={notes}
              />
            </FieldGroup>
            <FieldGroup label="Colour" optional>
              <ColourInput
                disabled={disabled}
                id="tasting-colour"
                name="tasting-colour"
                onChange={setColour}
                value={colour}
              />
            </FieldGroup>
            <Field
              hint="Describe the aroma, taste, texture, and finish in your own words."
              htmlFor="tasting-comments"
              label="Comments"
              optional
            >
              <Textarea
                id="tasting-comments"
                onChange={(event) => setComments(event.currentTarget.value)}
                placeholder="Tell us how it drank."
                rows={6}
                value={comments}
              />
            </Field>
          </FormSection>
          <FormSection title="Context">
            <Field htmlFor="tasting-serving" label="Served" optional>
              <Select
                id="tasting-serving"
                onChange={(event) => setServing(event.currentTarget.value)}
                value={serving}
              >
                <option value="">Not set</option>
                <option value="neat">Neat</option>
                <option value="splash">With water</option>
                <option value="rocks">On the rocks</option>
              </Select>
            </Field>
            <MemberPicker
              onChange={setFriends}
              options={memberOptions}
              value={friends}
            />
            <FieldGroup label="Picture" optional>
              <PictureInput
                disabled={disabled}
                id="tasting-picture"
                name="tasting-picture"
                onFilesSelected={() => undefined}
              />
            </FieldGroup>
          </FormSection>
        </FormStack>
      </fieldset>
    </form>
  );
}

const styles = stylex.create({
  form: { boxSizing: "border-box", width: "100%", maxWidth: "760px" },
  fields: { minWidth: 0, margin: 0, padding: 0, borderWidth: 0 },
});
