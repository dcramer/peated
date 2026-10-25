import * as stylex from "@stylexjs/stylex";

import { colors, space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

function getEntityKindIconUrl(kind: Entity["kind"]) {
  switch (kind) {
    case "bottler":
      return "/assets/entities/bottler.svg";
    case "brand":
      return "/assets/entities/brand.svg";
    case "distillery":
      return "/assets/entities/distiller.svg";
    case "company":
    default:
      return "/assets/entities/entity.svg";
  }
}

function EntityKindIcon({ kind }: { kind: Entity["kind"] }) {
  return (
    <span
      aria-hidden="true"
      {...stylex.props(
        styles.icon,
        styles.mask(`url("${getEntityKindIconUrl(kind)}")`),
      )}
    />
  );
}

export function EntityImagePlaceholder({
  entityName,
  kind,
}: {
  entityName: string;
  kind: Entity["kind"];
}) {
  return (
    <div
      aria-label={`No image available for ${entityName}`}
      role="img"
      {...stylex.props(styles.placeholder)}
    >
      <EntityKindIcon kind={kind} />
    </div>
  );
}

const styles = stylex.create({
  placeholder: {
    display: "flex",
    width: "100%",
    aspectRatio: "8 / 5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.x4,
    backgroundColor: colors.inset,
  },
  icon: {
    display: "block",
    width: "72px",
    height: "72px",
    backgroundColor: colors.inkMuted,
    opacity: 0.38,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  },
  mask: (image: string) => ({
    maskImage: image,
    WebkitMaskImage: image,
  }),
});
