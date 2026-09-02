"use client";

import * as stylex from "@stylexjs/stylex";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { ImageAttribution, ImageViewer } from "@peated/web/components";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

function ImageNavigationButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: "next" | "previous";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      type="button"
      {...stylex.props(styles.navigationButton)}
    >
      <span
        aria-hidden="true"
        {...stylex.props(
          styles.navigationButtonSurface,
          disabled && styles.navigationButtonSurfaceDisabled,
        )}
      >
        <Icon size={17} strokeWidth={1.75} />
      </span>
    </button>
  );
}

export function EntityImageGallery({ entity }: { entity: Entity }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const images = entity.images ?? [];
  if (!images.length) return null;

  const currentIndex = Math.min(selectedIndex, images.length - 1);
  const image = images[currentIndex]!;
  const multipleImages = images.length > 1;
  const imageLabel =
    image.caption ||
    (multipleImages
      ? `${entity.name} image ${currentIndex + 1} of ${images.length}`
      : `${entity.name} primary image`);
  const hasDetails = image.caption || image.sourceUrl || image.license;

  return (
    <section
      aria-label={`Images of ${entity.name}`}
      {...stylex.props(styles.gallery)}
    >
      <figure {...stylex.props(styles.figure)}>
        <ImageViewer
          alt={imageLabel}
          caption={image.caption}
          key={image.id}
          label={imageLabel}
          src={image.imageUrl}
        >
          <img
            alt={imageLabel}
            src={image.imageUrl}
            {...stylex.props(styles.image)}
          />
        </ImageViewer>
        {hasDetails || multipleImages ? (
          <figcaption {...stylex.props(styles.footer)}>
            {hasDetails ? (
              <div {...stylex.props(styles.caption)}>
                {image.caption ? (
                  <span title={image.caption} {...stylex.props(styles.title)}>
                    {image.caption}
                  </span>
                ) : null}
                <ImageAttribution
                  license={image.license}
                  sourceUrl={image.sourceUrl}
                />
              </div>
            ) : null}
            {multipleImages ? (
              <div
                aria-label="Image navigation"
                role="group"
                {...stylex.props(styles.pagination)}
              >
                <ImageNavigationButton
                  direction="previous"
                  disabled={currentIndex === 0}
                  label="Show previous image"
                  onClick={() => setSelectedIndex(currentIndex - 1)}
                />
                <span
                  aria-atomic="true"
                  aria-live="polite"
                  {...stylex.props(styles.position)}
                >
                  {currentIndex + 1} / {images.length}
                </span>
                <ImageNavigationButton
                  direction="next"
                  disabled={currentIndex === images.length - 1}
                  label="Show next image"
                  onClick={() => setSelectedIndex(currentIndex + 1)}
                />
              </div>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}

const styles = stylex.create({
  gallery: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    marginTop: space.x4,
  },
  figure: {
    margin: 0,
  },
  image: {
    aspectRatio: "16 / 10",
    boxSizing: "border-box",
    backgroundColor: colors.imageBackground,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: "3px",
    display: "block",
    objectFit: "contain",
    padding: "2px",
    width: "100%",
  },
  footer: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
    marginTop: space.x2,
    flexWrap: "wrap",
  },
  caption: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x1,
    color: colors.inkMuted,
  },
  title: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: space.x1,
    marginLeft: "auto",
  },
  navigationButton: {
    display: "grid",
    width: controlMetrics.controlHeightSmall,
    height: controlMetrics.controlHeightSmall,
    flexShrink: 0,
    placeItems: "center",
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    cursor: {
      default: "pointer",
      ":disabled": "default",
    },
    opacity: {
      default: 1,
      ":hover": 0.78,
      ":active": 0.78,
      ":disabled": 1,
    },
    transitionDuration: "120ms",
    transitionProperty: "opacity",
  },
  navigationButtonSurface: {
    display: "grid",
    width: "34px",
    height: "34px",
    placeItems: "center",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.fieldBackground,
    boxShadow: `inset 0 0 0 1px ${colors.sectionRule}`,
    pointerEvents: "none",
  },
  navigationButtonSurfaceDisabled: {
    opacity: 0.35,
  },
  position: {
    minWidth: "40px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    textAlign: "center",
  },
});
