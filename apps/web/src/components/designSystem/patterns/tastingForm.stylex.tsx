"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, space } from "../../../styles/tokens.stylex";
import type { MemberPickerOption, RatingBand } from "../components";
import {
  Button,
  ColourInput,
  Field,
  FieldGroup,
  MemberPicker,
  NotePickerField,
  PictureInput,
  RatingBandInput,
  Select,
  SelectedBottleSummary,
  Textarea,
  TextInput,
} from "../components";
import { memberOptions, noteOptions } from "../components/storyData";

const COMPACT = "@media (max-width: 639px)";

const servingStyles = ["neat", "splash", "rocks"] as const;
type ServingStyle = (typeof servingStyles)[number];

function isServingStyle(value: string): value is ServingStyle {
  return servingStyles.some((servingStyle) => servingStyle === value);
}

export type TastingFormPatternProps = {
  initialRating?: RatingBand | null;
  submitting?: boolean;
};

export function TastingFormPattern({
  initialRating = null,
  submitting = false,
}: TastingFormPatternProps) {
  const [rating, setRating] = useState<RatingBand | null>(initialRating);
  const [colour, setColour] = useState<number | null>(10);
  const [date, setDate] = useState("2026-08-25");
  const [comments, setComments] = useState("");
  const [friends, setFriends] = useState<readonly MemberPickerOption[]>([]);
  const [notes, setNotes] = useState<readonly string[]>([]);
  const [serving, setServing] = useState<ServingStyle>("neat");

  const complete = rating !== null;

  return (
    <form
      aria-busy={submitting || undefined}
      onSubmit={(event) => event.preventDefault()}
      {...stylex.props(styles.form)}
    >
      <fieldset
        disabled={submitting}
        {...stylex.props(styles.fields, submitting && styles.fieldsPending)}
      >
        <div {...stylex.props(styles.context)}>
          <SelectedBottleSummary
            bottleId="B00872"
            metadata="Islay · 16 yr · 43.0% · ex-bourbon"
            name="Lagavulin 16"
          />
        </div>
        <div {...stylex.props(styles.panel)}>
          <RatingBandInput
            id="tasting-rating"
            name="tasting-rating"
            onChange={setRating}
            required
            value={rating}
          />
        </div>
        <div {...stylex.props(styles.formGrid)}>
          <Field htmlFor="tasting-date" label="Date" optional>
            <TextInput
              format="data"
              id="tasting-date"
              onChange={(event) => setDate(event.currentTarget.value)}
              type="date"
              value={date}
            />
          </Field>
          <Field htmlFor="tasting-serving" label="Served" optional>
            <Select
              id="tasting-serving"
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (isServingStyle(value)) setServing(value);
              }}
              value={serving}
            >
              <option value="neat">Neat</option>
              <option value="splash">With a splash of water</option>
              <option value="rocks">On the rocks</option>
            </Select>
          </Field>
        </div>
        <div {...stylex.props(styles.section, styles.panel)}>
          <FieldGroup label="Notes" optional>
            <NotePickerField
              notes={noteOptions}
              onChange={setNotes}
              value={notes}
            />
          </FieldGroup>
        </div>
        <div {...stylex.props(styles.section, styles.panel)}>
          <FieldGroup label="Colour" optional>
            <ColourInput
              id="tasting-colour"
              name="tasting-colour"
              onChange={setColour}
              value={colour}
            />
          </FieldGroup>
        </div>
        <div {...stylex.props(styles.notes, styles.panel)}>
          <Field
            hint="Describe the aroma, taste, texture, and finish in your own words."
            htmlFor="tasting-comments"
            label="Comments"
            optional
          >
            <Textarea
              id="tasting-comments"
              onChange={(event) => setComments(event.currentTarget.value)}
              value={comments}
            />
          </Field>
        </div>
        <div {...stylex.props(styles.section, styles.panel)}>
          <MemberPicker
            onChange={setFriends}
            options={memberOptions}
            value={friends}
          />
        </div>
        <div {...stylex.props(styles.section, styles.panel)}>
          <FieldGroup label="Picture" optional>
            <PictureInput
              id="tasting-picture"
              name="tasting-picture"
              onFilesSelected={() => undefined}
            />
          </FieldGroup>
        </div>
      </fieldset>
      <div {...stylex.props(styles.actions)}>
        <span
          {...stylex.props(
            foundationStyles.metadata,
            styles.muted,
            submitting && styles.actionCompanionPending,
          )}
        >
          {complete ? "Draft saved locally" : "Choose a rating before saving"}
        </span>
        <Button
          disabled={!complete}
          loading={submitting}
          loadingLabel="Saving your tasting"
          variant="accent"
        >
          Save tasting
        </Button>
      </div>
    </form>
  );
}

const styles = stylex.create({
  form: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "760px",
  },
  fields: {
    minWidth: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    transitionProperty: "opacity",
    transitionDuration: "120ms",
  },
  fieldsPending: {
    pointerEvents: "none",
    opacity: 0.5,
  },
  actionCompanionPending: {
    opacity: 0.5,
  },
  context: {
    marginBottom: "6px",
  },
  panel: {
    paddingTop: "22px",
    paddingRight: "24px",
    paddingBottom: "22px",
    paddingLeft: "24px",
    borderRadius: "3px",
    backgroundColor: colors.surface,
    [COMPACT]: {
      paddingTop: "20px",
      paddingRight: "20px",
      paddingBottom: "20px",
      paddingLeft: "20px",
    },
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [COMPACT]: "1fr",
    },
    gap: space.x4,
    marginTop: "6px",
    paddingTop: "22px",
    paddingRight: "24px",
    paddingBottom: "22px",
    paddingLeft: "24px",
    borderRadius: "3px",
    backgroundColor: colors.surface,
    [COMPACT]: {
      paddingTop: "20px",
      paddingRight: "20px",
      paddingBottom: "20px",
      paddingLeft: "20px",
    },
  },
  notes: {
    marginTop: "6px",
  },
  section: {
    marginTop: "6px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x4,
    rowGap: space.x3,
    marginTop: "6px",
    paddingTop: "14px",
    paddingRight: space.x4,
    paddingBottom: "14px",
    paddingLeft: space.x4,
    borderRadius: "3px",
    backgroundColor: colors.surface,
    flexWrap: "wrap",
  },
  muted: {
    color: colors.inkMuted,
  },
});
