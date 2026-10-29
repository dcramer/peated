import * as stylex from "@stylexjs/stylex";

import { colors, space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

// One illustration per kind. They are stylized on purpose so nobody takes
// them for a photo of the Entity itself (DESIGN.md, "Images and data").
const KIND_ILLUSTRATION_URL = {
  bottler: "/assets/entities/bottler.webp",
  brand: "/assets/entities/brand.webp",
  company: "/assets/entities/company.webp",
  distillery: "/assets/entities/distillery.webp",
} satisfies Record<Entity["kind"], string>;

export function EntityImagePlaceholder({
  entityName,
  kind,
}: {
  entityName: string;
  kind: Entity["kind"];
}) {
  return (
    <img
      alt={`No image available for ${entityName}`}
      src={KIND_ILLUSTRATION_URL[kind]}
      {...stylex.props(styles.placeholder)}
    />
  );
}

const styles = stylex.create({
  placeholder: {
    aspectRatio: "16 / 10",
    backgroundColor: colors.inset,
    borderRadius: "3px",
    display: "block",
    marginTop: space.x4,
    objectFit: "cover",
    width: "100%",
  },
});
