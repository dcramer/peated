import * as stylex from "@stylexjs/stylex";

import { ImageAttribution } from "@peated/web/components";
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
        {primary.caption || primary.sourceUrl || primary.license ? (
          <figcaption {...stylex.props(styles.caption)}>
            {primary.caption ? <span>{primary.caption}</span> : null}
            <ImageAttribution
              license={primary.license}
              sourceUrl={primary.sourceUrl}
            />
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
              {image.caption || image.sourceUrl || image.license ? (
                <figcaption {...stylex.props(styles.caption)}>
                  {image.caption ? <span>{image.caption}</span> : null}
                  <ImageAttribution
                    license={image.license}
                    sourceUrl={image.sourceUrl}
                  />
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
    boxSizing: "border-box",
    backgroundColor: colors.imageBackground,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: "3px",
    display: "block",
    objectFit: "contain",
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
    boxSizing: "border-box",
    backgroundColor: colors.imageBackground,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: "3px",
    display: "block",
    objectFit: "contain",
    width: "100%",
  },
  caption: {
    color: colors.inkMuted,
    marginTop: space.x2,
  },
});
