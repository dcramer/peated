"use client";

import * as stylex from "@stylexjs/stylex";
import { Camera, Users } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { Field, FieldGroup, Textarea, ValidationMessage } from "./field.stylex";
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

/** Groups a short form step and announces it when Back or Continue changes the fields. */
function TastingFormStep({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-label={title} {...stylex.props(styles.step)}>
      <h2 ref={heading} tabIndex={-1} {...stylex.props(styles.hiddenHeading)}>
        {title}
      </h2>
      {children}
    </section>
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
  flavors: ComponentProps<typeof NotePickerField> & { id: string };
  notesError?: string;
  flavorsError?: string;
  label?: string;
}) {
  return (
    <TastingFormStep title="Notes">
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
      <Field error={flavorsError} htmlFor={flavors.id} label="Flavors" optional>
        <NotePickerField {...flavors} />
      </Field>
    </TastingFormStep>
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
  const [picker, setPicker] = useState<"photo" | "friends" | null>(null);

  return (
    <TastingFormStep title="The pour">
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
          onClick={() => setPicker("photo")}
          variant="tonal"
        >
          <Camera aria-hidden="true" size={18} />
          {photo.preview ? "Photo attached" : "Add photo"}
        </Button>
        <Button
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setPicker("friends")}
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
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === "photo" ? "Photo" : "Friends"}
        footer={
          <Button fullWidth onClick={() => setPicker(null)} variant="accent">
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
    </TastingFormStep>
  );
}

/** Collects the tasting's rating only after notes and pour details. */
export function TastingRatingStep({
  error,
  ...props
}: RatingBandInputProps & { error?: string }) {
  return (
    <TastingFormStep title="Rating">
      <FieldGroup error={error} label="How was it?" required={props.required}>
        <RatingBandInput {...props} />
      </FieldGroup>
    </TastingFormStep>
  );
}

/** Collects an exact review score without repeating the progress heading. */
export function MemberReviewScoreStep({
  error,
  ...props
}: ReviewScoreInputProps & { error?: string }) {
  return (
    <TastingFormStep title="Score">
      <ReviewScoreInput {...props} invalid={Boolean(error)} />
      {error ? <ValidationMessage>{error}</ValidationMessage> : null}
    </TastingFormStep>
  );
}

const styles = stylex.create({
  step: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
  },
  hiddenHeading: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: 0,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
  },
  attachments: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: space.x2,
  },
});
