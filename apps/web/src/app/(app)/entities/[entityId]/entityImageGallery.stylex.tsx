import * as stylex from "@stylexjs/stylex";

import { colors, space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

export function EntityImageGallery({ entity }: { entity: Entity }) {
  const images = entity.images ?? [];
  if (!images.length) return null;

  const [primary, ...otherImages] = images;

  return (
    <section
      aria-label={`Images of ${entity.name}`}
      {...stylex.props(styles.gallery)}
    >
      <figure {...stylex.props(styles.primaryFigure)}>
        <img
          alt={primary.caption || `${entity.name} primary image`}
          src={primary.imageUrl}
          {...stylex.props(styles.primaryImage)}
        />
        {primary.caption ? (
          <figcaption {...stylex.props(styles.caption)}>
            {primary.caption}
          </figcaption>
        ) : null}
      </figure>
      {otherImages.length ? (
        <div {...stylex.props(styles.secondaryGrid)}>
          {otherImages.map((image) => (
            <figure key={image.id} {...stylex.props(styles.secondaryFigure)}>
              <img
                alt={image.caption || `${entity.name} image`}
                src={image.imageUrl}
                {...stylex.props(styles.secondaryImage)}
              />
              {image.caption ? (
                <figcaption {...stylex.props(styles.caption)}>
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
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
  primaryFigure: {
    margin: 0,
  },
  primaryImage: {
    aspectRatio: "16 / 10",
    backgroundColor: colors.inset,
    borderRadius: "3px",
    display: "block",
    objectFit: "cover",
    width: "100%",
  },
  secondaryGrid: {
    display: "grid",
    gap: space.x3,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  secondaryFigure: {
    margin: 0,
    minWidth: 0,
  },
  secondaryImage: {
    aspectRatio: "4 / 3",
    backgroundColor: colors.inset,
    borderRadius: "3px",
    display: "block",
    objectFit: "cover",
    width: "100%",
  },
  caption: {
    color: colors.inkMuted,
    marginTop: space.x2,
  },
});
