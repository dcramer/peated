import * as stylex from "@stylexjs/stylex";

import { colors, space } from "../../../../styles/tokens.stylex";

export function EntityImagePlaceholder({ entityName }: { entityName: string }) {
  return (
    <div
      aria-label={`No image available for ${entityName}`}
      role="img"
      {...stylex.props(styles.placeholder)}
    />
  );
}

const styles = stylex.create({
  placeholder: {
    width: "100%",
    aspectRatio: "8 / 5",
    marginTop: space.x4,
    backgroundColor: colors.inset,
  },
});
