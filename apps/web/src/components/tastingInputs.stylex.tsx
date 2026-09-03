"use client";

import { COLOR_SCALE, type SERVING_STYLE_LIST } from "@peated/server/constants";
import * as stylex from "@stylexjs/stylex";
import {
  Box,
  Check,
  Droplets,
  GlassWater,
  Minus,
  Plus,
  Upload,
} from "lucide-react";
import { useRef } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { Button, IconButton } from "./button.stylex";
import { RATING_BANDS, type RatingBand } from "./scoring.stylex";

const REVIEW_SCORE_TRACK_MIN = 60;

export type ServingStyle = (typeof SERVING_STYLE_LIST)[number];

export type ReviewScoreInputProps = {
  disabled?: boolean;
  id: string;
  invalid?: boolean;
  label?: string;
  name: string;
  onChange: (value: number | null) => void;
  placeholder?: string;
  required?: boolean;
  value: number | null;
};

/** Records one whole-number review score while showing its rating range. */
export function ReviewScoreInput({
  disabled = false,
  id,
  invalid = false,
  label = "Score out of 100",
  name,
  onChange,
  placeholder = "80",
  required = false,
  value,
}: ReviewScoreInputProps) {
  const selectedBand = RATING_BANDS.find(
    (band) => value !== null && value >= band.min && value <= band.max,
  );

  function stepScore(direction: -1 | 1) {
    const nextValue = value === null ? 80 : value + direction;
    onChange(Math.max(0, Math.min(100, nextValue)));
  }

  return (
    <div {...stylex.props(styles.reviewScoreRoot, disabled && styles.disabled)}>
      <div {...stylex.props(styles.ratingHeading)}>
        <label
          htmlFor={id}
          {...stylex.props(foundationStyles.fieldLabel, styles.ratingLabel)}
        >
          {label}
        </label>
        {required ? (
          <span
            {...stylex.props(foundationStyles.microLabel, styles.requiredLabel)}
          >
            Required
          </span>
        ) : null}
      </div>
      <div {...stylex.props(styles.reviewScoreHeading)}>
        <div {...stylex.props(styles.reviewScoreControls)}>
          <IconButton
            disabled={disabled || value === 0}
            icon={<Minus aria-hidden="true" size={18} />}
            label="One point lower"
            onClick={() => stepScore(-1)}
            size="lg"
            variant="tonal"
          />
          <input
            aria-invalid={invalid || undefined}
            aria-label={label}
            disabled={disabled}
            id={id}
            inputMode="numeric"
            max={100}
            min={0}
            name={name}
            onBlur={() => {
              if (value !== null) {
                onChange(Math.max(0, Math.min(100, Math.round(value))));
              }
            }}
            onChange={(event) => {
              const digits = event.currentTarget.value
                .replace(/[^0-9]/g, "")
                .slice(0, 3);
              onChange(digits === "" ? null : Math.min(100, Number(digits)));
            }}
            placeholder={placeholder}
            type="text"
            value={value ?? ""}
            {...stylex.props(
              styles.reviewScoreValue,
              invalid && styles.reviewScoreValueInvalid,
            )}
          />
          <IconButton
            disabled={disabled || value === 100}
            icon={<Plus aria-hidden="true" size={18} />}
            label="One point higher"
            onClick={() => stepScore(1)}
            size="lg"
            variant="tonal"
          />
        </div>
        <div aria-live="polite" {...stylex.props(styles.reviewScoreBand)}>
          <strong
            {...stylex.props(
              foundationStyles.rowTitle,
              styles.reviewScoreBandLabel,
            )}
          >
            {selectedBand?.label ?? "Choose a score"}
          </strong>
          <span
            {...stylex.props(
              foundationStyles.metadata,
              styles.reviewScoreBandRange,
            )}
          >
            {selectedBand?.range ?? "0–100"}
          </span>
        </div>
      </div>
      <div {...stylex.props(styles.reviewScoreScale)}>
        <div aria-hidden="true" {...stylex.props(styles.reviewScoreTrack)}>
          {RATING_BANDS.map((band) => (
            <span
              key={band.key}
              {...stylex.props(
                styles.reviewScoreSegment,
                selectedBand?.key === band.key &&
                  bandInputSelectedStyles[band.key],
              )}
            />
          ))}
          {value !== null ? (
            <span
              {...stylex.props(
                styles.reviewScoreMarker,
                styles.reviewScoreMarkerPosition(value),
              )}
            />
          ) : null}
        </div>
        <div
          aria-hidden="true"
          {...stylex.props(
            foundationStyles.metadata,
            styles.reviewScoreAnchors,
          )}
        >
          <span>60</span>
          <span {...stylex.props(styles.reviewScoreAnchor80)}>80 good</span>
          <span {...stylex.props(styles.reviewScoreAnchor90)}>
            90 outstanding
          </span>
          <span>100</span>
        </div>
      </div>
      <p {...stylex.props(foundationStyles.metadata, styles.reviewScoreHint)}>
        Whole numbers. Your score counts toward this bottle's review score and
        appears with your review.
      </p>
    </div>
  );
}

export type RatingBandInputProps = {
  disabled?: boolean;
  id: string;
  label?: string;
  name: string;
  onChange: (value: RatingBand | null) => void;
  required?: boolean;
  value: RatingBand | null;
};

/** Records one tasting rating as one of the five canonical bands. */
export function RatingBandInput({
  disabled = false,
  id,
  label = "How was it",
  name,
  onChange,
  required = false,
  value,
}: RatingBandInputProps) {
  return (
    <div {...stylex.props(styles.scoreRoot, disabled && styles.disabled)}>
      <div
        aria-label={label}
        role="radiogroup"
        {...stylex.props(styles.bandInputTrack)}
      >
        {RATING_BANDS.map((band) => {
          const checked = band.key === value;
          return (
            <label
              key={band.key}
              {...stylex.props(
                styles.bandInputCell,
                checked && styles.bandInputCellSelected,
                checked && bandInputSelectedStyles[band.key],
              )}
            >
              <input
                checked={checked}
                disabled={disabled}
                id={`${id}-${band.key}`}
                name={name}
                onChange={() => onChange(band.key)}
                required={required}
                type="radio"
                value={band.key}
                {...stylex.props(styles.visuallyHiddenInput)}
              />
              <span
                {...stylex.props(
                  foundationStyles.compactRowTitle,
                  styles.bandInputName,
                  checked && bandInputTextSelectedStyles[band.key],
                )}
              >
                <Check
                  aria-hidden="true"
                  size={13}
                  strokeWidth={2.5}
                  {...stylex.props(
                    styles.bandInputCheck,
                    !checked && styles.bandInputCheckHidden,
                  )}
                />
                {band.label}
              </span>
              <span
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.bandInputRange,
                  checked && bandInputTextSelectedStyles[band.key],
                )}
              >
                {band.range}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export type ServingStyleInputProps = {
  disabled?: boolean;
  id: string;
  name: string;
  onChange: (value: ServingStyle) => void;
  value: ServingStyle | null;
};

/** Records how the whisky was served with the three canonical choices. */
export function ServingStyleInput({
  disabled = false,
  id,
  name,
  onChange,
  value,
}: ServingStyleInputProps) {
  return (
    <div
      aria-label="Serving"
      role="radiogroup"
      {...stylex.props(styles.servingStyleTrack, disabled && styles.disabled)}
    >
      {SERVING_STYLE_OPTIONS.map(({ icon: Icon, label, value: option }) => {
        const checked = value === option;

        return (
          <label
            key={option}
            {...stylex.props(
              foundationStyles.interactive,
              styles.servingStyleCell,
              checked && styles.servingStyleCellSelected,
            )}
          >
            <input
              checked={checked}
              disabled={disabled}
              id={`${id}-${option}`}
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
              {...stylex.props(styles.visuallyHiddenInput)}
            />
            <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
            <span>{label}</span>
          </label>
        );
      })}
    </div>
  );
}

export type ColorInputProps = {
  disabled?: boolean;
  id: string;
  name: string;
  onChange: (value: number | null) => void;
  value: number | null;
};

/** Records the observed whisky color on Peated's fixed 0–20 reference scale. */
export function ColorInput({
  disabled = false,
  id,
  name,
  onChange,
  value,
}: ColorInputProps) {
  const selected =
    value === null
      ? null
      : (COLOR_SCALE.find(([number]) => number === value) ?? null);

  return (
    <div {...stylex.props(styles.colorRoot, disabled && styles.disabled)}>
      <div {...stylex.props(styles.colorHeading)}>
        <strong
          title={selected?.[1] ?? "Unsure"}
          {...stylex.props(foundationStyles.rowTitle, styles.colorName)}
        >
          {selected?.[1] ?? "Unsure"}
        </strong>
        {value !== null ? (
          <Button
            disabled={disabled}
            onClick={() => onChange(null)}
            size="sm"
            variant="tonal"
          >
            Unsure
          </Button>
        ) : null}
      </div>
      <div {...stylex.props(styles.colorScale)}>
        <div aria-hidden="true" {...stylex.props(styles.colorSwatches)}>
          {COLOR_SCALE.map(([number, , hex]) => (
            <span
              key={number}
              style={{ backgroundColor: hex }}
              {...stylex.props(
                styles.colorSwatch,
                number === value && styles.colorSwatchSelected,
              )}
            />
          ))}
        </div>
        <input
          aria-label="Color of the pour"
          aria-valuetext={selected?.[1] ?? "Unsure"}
          disabled={disabled}
          id={id}
          max={20}
          min={0}
          name={name}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          step={1}
          type="range"
          value={selected?.[0] ?? 0}
          {...stylex.props(styles.colorRange)}
        />
      </div>
      <div
        aria-hidden="true"
        {...stylex.props(foundationStyles.metadata, styles.colorAnchors)}
      >
        <span>clear</span>
        <span>gold</span>
        <span>amber</span>
        <span>dark</span>
      </div>
      <p
        aria-live="polite"
        {...stylex.props(foundationStyles.metadata, styles.colorHint)}
      >
        {selected
          ? `${selected[1]} · ${selected[0]} of 20`
          : "Bar light can lie. Unsure is a real answer."}
      </p>
    </div>
  );
}

export type PictureInputProps = {
  accept?: string;
  disabled?: boolean;
  id: string;
  label?: string;
  name: string;
  onFilesSelected: (files: FileList) => void;
  onRemove?: () => void;
  preview?: {
    alt: string;
    src: string;
  };
};

/** Opens a native file picker and presents the current picture as the control. */
export function PictureInput({
  accept = "image/*",
  disabled = false,
  id,
  label = "Add a picture",
  name,
  onFilesSelected,
  onRemove,
  preview,
}: PictureInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function chooseFile() {
    inputRef.current?.click();
  }

  return (
    <div {...stylex.props(styles.pictureRoot)}>
      <input
        accept={accept}
        aria-hidden="true"
        disabled={disabled}
        id={id}
        name={name}
        onChange={(event) => {
          if (event.currentTarget.files?.length) {
            onFilesSelected(event.currentTarget.files);
          }
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
        {...stylex.props(styles.hiddenFileInput)}
      />
      {preview ? (
        <div {...stylex.props(styles.pictureSelected)}>
          <button
            aria-label="Change picture"
            disabled={disabled}
            onClick={chooseFile}
            type="button"
            {...stylex.props(styles.picturePreviewButton)}
          >
            <img
              alt={preview.alt}
              src={preview.src}
              {...stylex.props(styles.picturePreview)}
            />
          </button>
          <div {...stylex.props(styles.pictureActions)}>
            <Button disabled={disabled} onClick={chooseFile} variant="tonal">
              Change picture
            </Button>
            {onRemove ? (
              <Button disabled={disabled} onClick={onRemove} variant="text">
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Button disabled={disabled} onClick={chooseFile} variant="tonal">
          <Upload aria-hidden="true" size={16} strokeWidth={1.75} />
          {label}
        </Button>
      )}
    </div>
  );
}

const styles = stylex.create({
  reviewScoreRoot: {
    width: "100%",
  },
  ratingHeading: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
  },
  ratingLabel: {
    color: colors.ink,
  },
  requiredLabel: {
    color: colors.accentDeep,
    fontStyle: "italic",
  },
  reviewScoreHeading: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    columnGap: space.x6,
    rowGap: space.x3,
    paddingTop: space.x3,
    "@media (max-width: 559px)": {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
  reviewScoreControls: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    columnGap: space.x2,
  },
  reviewScoreValue: {
    boxSizing: "border-box",
    width: "116px",
    height: controlMetrics.controlHeightLarge,
    padding: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      default: "transparent",
      ":hover": colors.fieldRule,
      ":focus": colors.accent,
    },
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "42px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.04em",
    lineHeight: 1,
    textAlign: "center",
    boxShadow: {
      default: "none",
      ":focus": `inset 0 0 0 1px ${colors.accent}`,
    },
  },
  reviewScoreValueInvalid: {
    borderColor: colors.critical,
    boxShadow: effects.errorRing,
  },
  reviewScoreBand: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
  },
  reviewScoreBandLabel: {
    color: colors.ink,
  },
  reviewScoreBandRange: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  reviewScoreScale: {
    paddingTop: space.x6,
  },
  reviewScoreTrack: {
    position: "relative",
    display: "grid",
    width: "100%",
    height: "10px",
    gridTemplateColumns: "20fr 5fr 5fr 5fr 6fr",
    columnGap: "2px",
  },
  reviewScoreSegment: {
    display: "block",
    minWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.hairline,
  },
  reviewScoreMarker: {
    position: "absolute",
    top: "-4px",
    bottom: "-4px",
    width: "2px",
    backgroundColor: colors.ink,
    transform: "translateX(-50%)",
  },
  reviewScoreMarkerPosition: (score: number) => ({
    left: `${((Math.max(REVIEW_SCORE_TRACK_MIN, Math.min(100, score)) - REVIEW_SCORE_TRACK_MIN) / (100 - REVIEW_SCORE_TRACK_MIN)) * 100}%`,
  }),
  reviewScoreAnchors: {
    position: "relative",
    display: "flex",
    height: "20px",
    justifyContent: "space-between",
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
    paddingTop: space.x1,
  },
  reviewScoreAnchor80: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
  },
  reviewScoreAnchor90: {
    position: "absolute",
    left: "75%",
    transform: "translateX(-50%)",
    "@media (max-width: 559px)": { display: "none" },
  },
  reviewScoreHint: {
    maxWidth: "62ch",
    marginTop: space.x3,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.inkMuted,
  },
  visuallyHiddenInput: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: 0,
    pointerEvents: "none",
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.45,
  },
  scoreRoot: {
    width: "100%",
  },
  bandInputTrack: {
    display: "grid",
    width: "100%",
    height: "64px",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: space.x1,
    "@media (max-width: 559px)": {
      height: "auto",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x2,
    },
  },
  bandInputCell: {
    position: "relative",
    minWidth: 0,
    display: "flex",
    height: "64px",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    rowGap: space.x1,
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.fieldBackground,
    cursor: "pointer",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.fieldRule}`,
      ":hover": `inset 0 0 0 1px ${colors.inkMuted}`,
      ":focus-within": effects.focusRing,
    },
    opacity: {
      default: 1,
      ":hover": 0.86,
    },
    "@media (max-width: 559px)": {
      height: "48px",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingRight: space.x3,
      paddingLeft: space.x3,
    },
  },
  bandInputCellSelected: {
    boxShadow: {
      default: "none",
      ":hover": "none",
      ":focus-within": effects.focusRing,
    },
  },
  band1Selected: {
    backgroundColor: colors.band1,
  },
  band2Selected: {
    backgroundColor: colors.band2,
  },
  band3Selected: {
    backgroundColor: colors.band3,
  },
  band4Selected: {
    backgroundColor: colors.band4,
  },
  band5Selected: {
    backgroundColor: colors.band5,
  },
  bandInputName: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    columnGap: space.x1,
    color: colors.ink,
    pointerEvents: "none",
  },
  bandInputRange: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
    pointerEvents: "none",
  },
  bandInputCheck: {
    flexShrink: 0,
  },
  bandInputCheckHidden: {
    visibility: "hidden",
  },
  bandInputTextSelectedLight: {
    color: colors.ink,
  },
  bandInputTextSelectedDark: {
    color: colors.ground,
  },
  servingStyleTrack: {
    display: "grid",
    width: "100%",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: space.x2,
  },
  servingStyleCell: {
    position: "relative",
    display: "flex",
    minWidth: 0,
    height: "44px",
    alignItems: "center",
    justifyContent: "center",
    columnGap: space.x2,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.fieldBackground,
    color: colors.inkMuted,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.fieldRule}`,
      ":hover": `inset 0 0 0 1px ${colors.inkMuted}`,
      ":focus-within": effects.focusRing,
    },
  },
  servingStyleCellSelected: {
    backgroundColor: colors.accentTint,
    color: colors.ink,
    boxShadow: {
      default: `inset 0 0 0 2px ${colors.accent}`,
      ":hover": `inset 0 0 0 2px ${colors.accent}`,
      ":focus-within": effects.focusRing,
    },
  },
  colorRoot: {
    width: "100%",
  },
  colorHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x3,
    minHeight: controlMetrics.controlHeightSmall,
    marginBottom: space.x3,
  },
  colorName: {
    minWidth: 0,
    overflow: "hidden",
    color: colors.ink,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  colorScale: {
    position: "relative",
    height: "44px",
    borderRadius: controlMetrics.radiusSmall,
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  colorSwatches: {
    position: "absolute",
    inset: 0,
    display: "grid",
    gridTemplateColumns: "repeat(21, minmax(0, 1fr))",
    alignItems: "center",
    gap: "1px",
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
  },
  colorSwatch: {
    height: "32px",
    transitionProperty: "height",
    transitionDuration: "120ms",
  },
  colorSwatchSelected: {
    height: "44px",
  },
  colorRange: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
    cursor: "ew-resize",
  },
  colorAnchors: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "6px",
    color: colors.inkMuted,
  },
  colorHint: {
    marginTop: space.x2,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.inkMuted,
  },
  pictureRoot: {
    width: "100%",
  },
  hiddenFileInput: {
    display: "none",
  },
  pictureSelected: {
    display: "flex",
    alignItems: "flex-start",
    columnGap: space.x4,
    rowGap: space.x3,
    flexWrap: "wrap",
  },
  picturePreviewButton: {
    boxSizing: "border-box",
    width: "160px",
    height: "160px",
    padding: 0,
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: colors.imageBackground,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":hover": 0.86,
      ":disabled": 0.45,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  picturePreview: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  pictureActions: {
    display: "flex",
    alignItems: "center",
    columnGap: space.x2,
    rowGap: space.x2,
    flexWrap: "wrap",
  },
});
const bandInputSelectedStyles = {
  mediocre: styles.band1Selected,
  good: styles.band2Selected,
  very_good: styles.band3Selected,
  outstanding: styles.band4Selected,
  unicorn: styles.band5Selected,
} satisfies Record<RatingBand, stylex.StyleXStyles>;
const bandInputTextSelectedStyles = {
  mediocre: styles.bandInputTextSelectedLight,
  good: styles.bandInputTextSelectedLight,
  very_good: styles.bandInputTextSelectedLight,
  outstanding: styles.bandInputTextSelectedDark,
  unicorn: styles.bandInputTextSelectedDark,
} satisfies Record<RatingBand, stylex.StyleXStyles>;
const SERVING_STYLE_OPTIONS = [
  { icon: GlassWater, label: "Neat", value: "neat" },
  { icon: Box, label: "Rocks", value: "rocks" },
  { icon: Droplets, label: "Splash", value: "splash" },
] as const satisfies ReadonlyArray<{
  icon: typeof GlassWater;
  label: string;
  value: ServingStyle;
}>;
