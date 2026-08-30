import * as stylex from "@stylexjs/stylex";

import BottlerIcon from "@peated/web/assets/bottler.svg";
import BrandIcon from "@peated/web/assets/brand.svg";
import DistillerIcon from "@peated/web/assets/distiller.svg";
import EntityIcon from "@peated/web/assets/entity.svg";
import { colors, space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

function EntityKindIcon({ kind }: { kind: Entity["kind"] }) {
  const props = {
    "aria-hidden": true,
    focusable: false,
    ...stylex.props(styles.icon),
  } as const;

  switch (kind) {
    case "bottler":
      return <BottlerIcon {...props} />;
    case "brand":
      return <BrandIcon {...props} />;
    case "company":
      return <EntityIcon {...props} />;
    case "distillery":
      return <DistillerIcon {...props} />;
    default:
      return <EntityIcon {...props} />;
  }
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
    width: "72px",
    height: "72px",
    color: colors.inkMuted,
    opacity: 0.38,
  },
});
