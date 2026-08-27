"use client";

import { COLOR_SCALE } from "@peated/server/constants";
import * as stylex from "@stylexjs/stylex";
import { Minus, Plus, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { Button } from "./button.stylex";
import {
  getRatingBandForPoint,
  RATING_BANDS,
  type RatingBand,
  type RatingGrain,
  type RatingValue,
  type Verdict,
} from "./scoring.stylex";

const COMPACT = "@media (max-width: 639px)";

const verdictOptions = [
  { description: "Not my thing", label: "Pass", value: "pass" },
  {
    description: "Enjoyable, would drink again",
    label: "Sip",
    value: "sip",
  },
  {
    description: "Amazing, would seek out",
    label: "Savor",
    value: "savor",
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: Verdict;
}[];

export type VerdictInputProps = {
  disabled?: boolean;
  id: string;
  label?: string;
  name: string;
  onChange: (value: Verdict | null) => void;
  required?: boolean;
  value: Verdict | null;
};

/** Records one member's Pass, Sip, or Savor verdict. */
export function VerdictInput({
  disabled = false,
  id,
  label = "How was it",
  name,
  onChange,
  required = false,
  value,
}: VerdictInputProps) {
  const selected = verdictOptions.find((option) => option.value === value);

  return (
    <div {...stylex.props(styles.verdictRoot)}>
      <div {...stylex.props(styles.ratingHeading)}>
        <span {...stylex.props(styles.ratingLabel)}>{label}</span>
        {required ? (
          <span {...stylex.props(styles.requiredLabel)}>Required</span>
        ) : null}
      </div>
      <div aria-label={label} role="radiogroup" {...stylex.props(styles.track)}>
        {verdictOptions.map((option, index) => {
          const checked = option.value === value;

          return (
            <label
              key={option.value}
              {...stylex.props(
                styles.verdictOption,
                index === 0 && styles.verdictFirst,
                index === verdictOptions.length - 1 && styles.verdictLast,
                checked && styles.verdictSelected,
                disabled && styles.disabled,
              )}
            >
              <input
                checked={checked}
                disabled={disabled}
                id={`${id}-${option.value}`}
                name={name}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
                {...stylex.props(styles.visuallyHiddenInput)}
              />
              <strong {...stylex.props(styles.verdictLabel)}>
                {option.label}
              </strong>
              <span {...stylex.props(styles.verdictDescription)}>
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
      {selected ? (
        <p aria-live="polite" {...stylex.props(styles.selectedVerdictMeaning)}>
          <strong>{selected.label}</strong> —{" "}
          {selected.description.toLowerCase()}.
        </p>
      ) : (
        <p {...stylex.props(styles.selectedVerdictMeaning)}>
          Pass · not my thing — Sip · enjoyable, would drink again — Savor ·
          amazing, would seek out
        </p>
      )}
    </div>
  );
}

export type ScoreInputProps = {
  disabled?: boolean;
  grain: RatingGrain;
  id: string;
  label?: string;
  name: string;
  onChange: (value: RatingValue) => void;
  onGrainChange: (grain: RatingGrain) => void;
  required?: boolean;
  value: RatingValue;
};

/** Records one rating as a picked band or an exact point on the same ruler. */
export function ScoreInput({
  disabled = false,
  grain,
  id,
  label = "How was it",
  name,
  onChange,
  onGrainChange,
  required = false,
  value,
}: ScoreInputProps) {
  const score =
    grain === "point" && value?.grain === "point"
      ? clampScore(value.point)
      : null;
  const selectedBand =
    grain === "band" && value?.grain === "band"
      ? RATING_BANDS.find((band) => band.key === value.band)
      : score === null
        ? undefined
        : getRatingBandForPoint(score);

  function step(delta: number) {
    onChange({ grain: "point", point: clampScore((score ?? 85) + delta) });
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.value;
    onChange(
      next === "" ? null : { grain: "point", point: clampScore(Number(next)) },
    );
  }

  return (
    <div
      data-grain={grain}
      {...stylex.props(styles.scoreRoot, disabled && styles.disabled)}
    >
      <div {...stylex.props(styles.ratingHeading)}>
        <span {...stylex.props(styles.ratingLabel)}>{label}</span>
        {required ? (
          <span {...stylex.props(styles.requiredLabel)}>Required</span>
        ) : null}
      </div>
      {grain === "point" ? (
        <>
          <div {...stylex.props(styles.pointControl)}>
            <button
              aria-label="Decrease score"
              disabled={disabled || score === 0}
              onClick={() => step(-1)}
              type="button"
              {...stylex.props(styles.scoreStep)}
            >
              <Minus aria-hidden="true" size={20} strokeWidth={1.75} />
            </button>
            <div {...stylex.props(styles.scoreValueGroup)}>
              <div {...stylex.props(styles.scoreFigure)}>
                <input
                  aria-label="Score out of 100"
                  disabled={disabled}
                  id={id}
                  inputMode="numeric"
                  max={100}
                  min={0}
                  name={name}
                  onChange={handleInput}
                  placeholder="–"
                  required={required}
                  step={1}
                  type="number"
                  value={score ?? ""}
                  {...stylex.props(styles.scoreInput)}
                />
                <span aria-hidden="true" {...stylex.props(styles.scoreOutOf)}>
                  / 100
                </span>
              </div>
              <p aria-live="polite" {...stylex.props(styles.scoreBand)}>
                {selectedBand?.label ?? "Choose a score"}
              </p>
            </div>
            <button
              aria-label="Increase score"
              disabled={disabled || score === 100}
              onClick={() => step(1)}
              type="button"
              {...stylex.props(styles.scoreStep)}
            >
              <Plus aria-hidden="true" size={20} strokeWidth={1.75} />
            </button>
          </div>
          <div aria-hidden="true" {...stylex.props(styles.pointTrack)}>
            {score !== null ? (
              <span {...stylex.props(styles.pointMarker(score))} />
            ) : null}
          </div>
          <button
            disabled={disabled}
            onClick={() => onGrainChange("band")}
            type="button"
            {...stylex.props(styles.grainAction)}
          >
            Pick a band instead
          </button>
        </>
      ) : (
        <>
          <div {...stylex.props(styles.bandSelectionHeading)}>
            <strong {...stylex.props(styles.selectedBandLabel)}>
              {selectedBand?.label ?? "Pick a band"}
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
              const checked =
                value?.grain === "band" && band.key === value.band;
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
                    onChange={() => onChange({ band: band.key, grain: "band" })}
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
          <button
            disabled={disabled}
            onClick={() => onGrainChange("point")}
            type="button"
            {...stylex.props(styles.grainAction)}
          >
            Score out of 100
          </button>
        </>
      )}
    </div>
  );
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
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
        <Button
          aria-pressed={value === null}
          disabled={disabled}
          onClick={() => onChange(null)}
          size="sm"
          variant="tonal"
        >
          Unsure
        </Button>
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
  verdictRoot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: space.x2,
  },
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
  track: {
    display: "grid",
    width: "100%",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "2px",
  },
  verdictOption: {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    minHeight: { default: "68px", [COMPACT]: "76px" },
    flexDirection: "column",
    alignItems: { default: "flex-start", [COMPACT]: "center" },
    justifyContent: "center",
    rowGap: space.x1,
    padding: { default: space.x3, [COMPACT]: space.x2 },
    borderRadius: 0,
    backgroundColor: colors.inset,
    color: colors.ink,
    textAlign: { default: "left", [COMPACT]: "center" },
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
    transitionProperty: "background-color, color, opacity",
    transitionDuration: "120ms",
  },
  verdictFirst: {
    borderTopLeftRadius: controlMetrics.radiusSmall,
    borderBottomLeftRadius: controlMetrics.radiusSmall,
  },
  verdictLast: {
    borderTopRightRadius: controlMetrics.radiusSmall,
    borderBottomRightRadius: controlMetrics.radiusSmall,
  },
  verdictSelected: {
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  verdictLabel: {
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.1,
  },
  verdictDescription: {
    overflow: "hidden",
    fontFamily: fonts.reading,
    fontSize: { default: "12px", [COMPACT]: "11px" },
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    [COMPACT]: {
      display: "none",
    },
  },
  selectedVerdictMeaning: {
    display: "none",
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.45,
    [COMPACT]: {
      display: "block",
    },
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
  pointControl: {
    display: "flex",
    alignItems: "center",
    columnGap: { default: space.x4, [COMPACT]: space.x3 },
    marginTop: space.x3,
  },
  pointTrack: {
    position: "relative",
    height: "8px",
    marginTop: space.x4,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
  },
  pointMarker: (score: number) => ({
    position: "absolute",
    top: "-3px",
    left: `calc(${clampScore(score)}% - 1px)`,
    width: "2px",
    height: "14px",
    backgroundColor: colors.ink,
  }),
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
  grainAction: {
    width: "fit-content",
    marginTop: space.x3,
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.35,
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":disabled": 0.45,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  visuallyHiddenText: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
  scoreControl: {
    display: "flex",
    alignItems: "center",
    columnGap: { default: space.x4, [COMPACT]: space.x3 },
    marginTop: space.x3,
  },
  scoreStep: {
    display: "inline-flex",
    width: { default: "40px", [COMPACT]: "52px" },
    height: { default: "40px", [COMPACT]: "52px" },
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
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
  scoreValueGroup: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    alignItems: "baseline",
    justifyContent: "center",
    columnGap: space.x4,
    [COMPACT]: {
      alignItems: "center",
      flexDirection: "column",
      rowGap: "2px",
    },
  },
  scoreFigure: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "center",
    gap: space.x2,
  },
  scoreInput: {
    boxSizing: "border-box",
    width: { default: "92px", [COMPACT]: "106px" },
    height: { default: "48px", [COMPACT]: "52px" },
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
    outline: "none",
    appearance: "textfield",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: { default: "44px", [COMPACT]: "46px" },
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
    letterSpacing: "-0.05em",
    lineHeight: 1,
    textAlign: "center",
    boxShadow: {
      default: `inset 0 -2px 0 ${colors.inset}`,
      ":focus-visible": `inset 0 -2px 0 ${colors.accent}`,
    },
    "::-webkit-inner-spin-button": {
      appearance: "none",
    },
    "::-webkit-outer-spin-button": {
      appearance: "none",
    },
  },
  scoreOutOf: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.45,
    [COMPACT]: {
      display: "none",
    },
  },
  scoreBand: {
    flexShrink: 0,
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: { default: "15px", [COMPACT]: "14px" },
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  scoreScale: {
    position: "relative",
    height: { default: "10px", [COMPACT]: "44px" },
    marginTop: space.x4,
    borderRadius: {
      default: controlMetrics.radiusSmall,
      [COMPACT]: controlMetrics.radius,
    },
    backgroundColor: colors.inset,
  },
  scoreFill: (position: number) => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: `${position}%`,
    borderRadius: "inherit",
    backgroundColor: colors.sectionRule,
  }),
  scoreMarker: (position: number) => ({
    position: "absolute",
    top: { default: "-4px", [COMPACT]: "-4px" },
    bottom: { default: "auto", [COMPACT]: "-4px" },
    left: `calc(${position}% - 2px)`,
    width: { default: "3px", [COMPACT]: "4px" },
    height: { default: "18px", [COMPACT]: "auto" },
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.ink,
    pointerEvents: "none",
  }),
  scoreRange: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
    cursor: "ew-resize",
  },
  scoreFillEmpty: {
    opacity: 0,
  },
  scoreMarkerEmpty: {
    opacity: 0,
  },
  scoreAnchors: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
  },
  scoreEndpoint: {
    visibility: { default: "hidden", [COMPACT]: "visible" },
  },
  scoreGuidance: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.5,
  },
  desktopScoreGuidance: {
    display: "block",
    [COMPACT]: {
      display: "none",
    },
  },
  mobileScoreGuidance: {
    display: "none",
    [COMPACT]: {
      display: "block",
    },
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
  veryGood: styles.midBandSelected,
  outstanding: styles.highBandSelected,
  unicorn: styles.highBandSelected,
} satisfies Record<RatingBand, stylex.StyleXStyles>;
