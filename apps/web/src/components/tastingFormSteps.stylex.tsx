"use client";

import * as stylex from "@stylexjs/stylex";
import { Camera, Users } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { Field, FieldGroup, Textarea, ValidationMessage } from "./field.stylex";
import { FormStep } from "./formLayout.stylex";
import { MemberPicker, type MemberPickerProps } from "./memberPicker.stylex";
import { NotePickerField } from "./notePicker.stylex";
import { Slideout } from "./slideout.stylex";
import {
  ColorInput,
  PictureInput,
  RatingBandInput,
  ReviewScoreInput,
  ServingStyleInput,
  type ColorInputProps,
  type PictureInputProps,
  type RatingBandInputProps,
  type ReviewScoreInputProps,
  type ServingStyleInputProps,
} from "./tastingInputs.stylex";

type NotePickerFieldProps = ComponentProps<typeof NotePickerField> & {
  id: string;
};

function TastingNoteField({
  error,
  label,
  picker,
}: {
  error?: string;
  label: string;
  picker: NotePickerFieldProps;
}) {
  return (
    <Field error={error} htmlFor={picker.id} label={label} optional>
      <NotePickerField {...picker} label={label} />
    </Field>
  );
}

/** Captures a member's words before asking for flavors, serving details, or a rating. */
export function TastingNotesStep({
  notes,
  flavors,
  notesError,
  flavorsError,
  label = "What stood out?",
}: {
  notes: ComponentProps<typeof Textarea> & { id: string };
  flavors: NotePickerFieldProps;
  notesError?: string;
  flavorsError?: string;
  label?: string;
}) {
  return (
    <FormStep title="Notes">
      <Field
        error={notesError}
        errorId={`${notes.id}-error`}
        htmlFor={notes.id}
        label={label}
        optional
      >
        <Textarea
          {...notes}
          aria-describedby={notesError ? `${notes.id}-error` : undefined}
          invalid={Boolean(notesError)}
          placeholder="What do you want to remember?"
          rows={3}
        />
      </Field>
      <TastingNoteField error={flavorsError} label="Flavors" picker={flavors} />
    </FormStep>
  );
}

export function MemberReviewNotesStep({
  notes,
  nose,
  palate,
  finish,
  notesError,
  noseError,
  palateError,
  finishError,
}: {
  notes: ComponentProps<typeof Textarea> & { id: string };
  nose: NotePickerFieldProps;
  palate: NotePickerFieldProps;
  finish: NotePickerFieldProps;
  notesError?: string;
  noseError?: string;
  palateError?: string;
  finishError?: string;
}) {
  return (
    <FormStep title="Notes">
      <Field
        error={notesError}
        errorId={`${notes.id}-error`}
        htmlFor={notes.id}
        label="What do you think?"
        optional
      >
        <Textarea
          {...notes}
          aria-describedby={notesError ? `${notes.id}-error` : undefined}
          invalid={Boolean(notesError)}
          placeholder="What do you want to remember?"
          rows={3}
        />
      </Field>
      <TastingNoteField error={noseError} label="Nose" picker={nose} />
      <TastingNoteField error={palateError} label="Palate" picker={palate} />
      <TastingNoteField error={finishError} label="Finish" picker={finish} />
    </FormStep>
  );
}

/** Keeps serving and color visible; optional photos and friends open in the shared picker panel. */
export function TastingPourStep({
  serving,
  color,
  photo,
  friends,
  servingError,
  colorError,
  friendsError,
  disabled = false,
}: {
  serving: ServingStyleInputProps;
  color: ColorInputProps;
  photo: PictureInputProps;
  friends: MemberPickerProps;
  servingError?: string;
  colorError?: string;
  friendsError?: string;
  disabled?: boolean;
}) {
  const [picker, setPicker] = useState<"photo" | "friends">("photo");
  const [pickerOpen, setPickerOpen] = useState(false);

  function openPicker(nextPicker: "photo" | "friends") {
    setPicker(nextPicker);
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    if (picker === "friends") friends.onQueryChange?.("");
  }

  return (
    <FormStep title="The pour">
      <FieldGroup error={servingError} label="Serving style" optional>
        <ServingStyleInput {...serving} />
      </FieldGroup>
      <Field error={colorError} htmlFor={color.id} label="Color" optional>
        <ColorInput {...color} />
      </Field>
      <div {...stylex.props(styles.attachments)}>
        <Button
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => openPicker("photo")}
          variant="tonal"
        >
          <Camera aria-hidden="true" size={18} />
          {photo.preview ? "Photo attached" : "Add photo"}
        </Button>
        <Button
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => openPicker("friends")}
          variant="tonal"
        >
          <Users aria-hidden="true" size={18} />
          {friends.value.length
            ? `${friends.value.length} ${friends.value.length === 1 ? "friend" : "friends"}`
            : "Add friends"}
        </Button>
      </div>
      {friendsError ? (
        <ValidationMessage>{friendsError}</ValidationMessage>
      ) : null}
      <Slideout
        open={pickerOpen}
        onClose={closePicker}
        title={picker === "photo" ? "Photo" : "Friends"}
        footer={
          <Button fullWidth onClick={closePicker} variant="accent">
            Done
          </Button>
        }
      >
        {picker === "photo" ? (
          <PictureInput {...photo} label="Add photo" />
        ) : (
          <MemberPicker {...friends} />
        )}
      </Slideout>
    </FormStep>
  );
}

/** Collects the tasting's rating only after notes and pour details. */
export function TastingRatingStep({
  error,
  ...props
}: RatingBandInputProps & { error?: string }) {
  return (
    <FormStep title="Rating">
      <FieldGroup error={error} label="How was it?" required={props.required}>
        <RatingBandInput {...props} />
      </FieldGroup>
    </FormStep>
  );
}

/** Collects an exact review score without repeating the progress heading. */
export function MemberReviewScoreStep({
  error,
  ...props
}: ReviewScoreInputProps & { error?: string }) {
  return (
    <FormStep title="Score">
      <ReviewScoreInput {...props} invalid={Boolean(error)} />
      {error ? <ValidationMessage>{error}</ValidationMessage> : null}
    </FormStep>
  );
}

const styles = stylex.create({
  attachments: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: space.x2,
  },
});
