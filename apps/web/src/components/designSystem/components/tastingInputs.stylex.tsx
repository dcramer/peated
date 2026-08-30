"use client";

import { COLOR_SCALE } from "@peated/server/constants";
import * as stylex from "@stylexjs/stylex";
import { Upload } from "lucide-react";
import { useRef } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { RATING_BANDS, type RatingBand } from "./scoring.stylex";

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
  const selectedBand = RATING_BANDS.find((band) => band.key === value);

  return (
    <div {...stylex.props(styles.scoreRoot, disabled && styles.disabled)}>
      <div {...stylex.props(styles.ratingHeading)}>
        <span {...stylex.props(styles.ratingLabel)}>{label}</span>
        {required ? (
          <span {...stylex.props(styles.requiredLabel)}>Required</span>
        ) : null}
      </div>
      <div {...stylex.props(styles.bandSelectionHeading)}>
        <strong {...stylex.props(styles.selectedBandLabel)}>
          {selectedBand?.label ?? "Pick a rating"}
        </strong>
        {selectedBand ? (
          <span {...stylex.props(styles.selectedBandRange)}>
            {selectedBand.range}
          </span>
        ) : null}
      </div>
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
              <span {...stylex.props(styles.visuallyHiddenText)}>
                {band.label}, {band.range}
              </span>
            </label>
          );
        })}
      </div>
      <div aria-hidden="true" {...stylex.props(styles.bandInputRanges)}>
        {RATING_BANDS.map((band) => (
          <span key={band.key}>{band.shortRange}</span>
        ))}
      </div>
    </div>
  );
}

export type ColourInputProps = {
  disabled?: boolean;
  id: string;
  name: string;
  onChange: (value: number | null) => void;
  value: number | null;
};

/** Records the observed whisky colour on Peated's fixed 0–20 reference scale. */
export function ColourInput({
  disabled = false,
  id,
  name,
  onChange,
  value,
}: ColourInputProps) {
  const selected =
    value === null
      ? null
      : (COLOR_SCALE.find(([number]) => number === value) ?? null);

  return (
    <div {...stylex.props(styles.colourRoot, disabled && styles.disabled)}>
      <div {...stylex.props(styles.colourHeading)}>
        <strong {...stylex.props(styles.colourName)}>
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
      <div {...stylex.props(styles.colourScale)}>
        <div aria-hidden="true" {...stylex.props(styles.colourSwatches)}>
          {COLOR_SCALE.map(([number, , hex]) => (
            <span
              key={number}
              style={{ backgroundColor: hex }}
              {...stylex.props(
                styles.colourSwatch,
                number === value && styles.colourSwatchSelected,
              )}
            />
          ))}
        </div>
        <input
          aria-label="Colour of the pour"
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
          {...stylex.props(styles.colourRange)}
        />
      </div>
      <div aria-hidden="true" {...stylex.props(styles.colourAnchors)}>
        <span>clear</span>
        <span>gold</span>
        <span>amber</span>
        <span>dark</span>
      </div>
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

/** Opens a native file picker and presents the current tasting image as the control. */
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
  ratingHeading: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
  },
  ratingLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  requiredLabel: {
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
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
  bandSelectionHeading: {
    display: "flex",
    alignItems: "baseline",
    columnGap: space.x2,
    marginTop: space.x3,
  },
  selectedBandLabel: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  selectedBandRange: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.45,
  },
  bandInputTrack: {
    display: "grid",
    width: "100%",
    height: "44px",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "2px",
    marginTop: space.x3,
  },
  bandInputCell: {
    position: "relative",
    minWidth: 0,
    height: "44px",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
    opacity: {
      default: 1,
      ":hover": 0.86,
    },
  },
  lowBandSelected: {
    backgroundColor: colors.bandLow,
  },
  midBandSelected: {
    backgroundColor: colors.bandMid,
  },
  highBandSelected: {
    backgroundColor: colors.bandHigh,
  },
  bandInputRanges: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "2px",
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "9px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
    lineHeight: 1.35,
    textTransform: "uppercase",
  },
  visuallyHiddenText: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
  colourRoot: {
    width: "100%",
  },
  colourHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x3,
    marginBottom: space.x3,
  },
  colourName: {
    minWidth: 0,
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  colourScale: {
    position: "relative",
    height: "44px",
    borderRadius: controlMetrics.radiusSmall,
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  colourSwatches: {
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
  colourSwatch: {
    height: "32px",
    transitionProperty: "height",
    transitionDuration: "120ms",
  },
  colourSwatchSelected: {
    height: "44px",
  },
  colourRange: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
    cursor: "ew-resize",
  },
  colourAnchors: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
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
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: colors.inset,
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
  mediocre: styles.lowBandSelected,
  good: styles.lowBandSelected,
  very_good: styles.midBandSelected,
  outstanding: styles.highBandSelected,
  unicorn: styles.highBandSelected,
} satisfies Record<RatingBand, stylex.StyleXStyles>;
