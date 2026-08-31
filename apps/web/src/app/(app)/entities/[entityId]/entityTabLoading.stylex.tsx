import * as stylex from "@stylexjs/stylex";

import { LoadingList } from "@peated/web/components";
import { space } from "../../../../styles/tokens.stylex";

export function EntityTabLoading({
  label,
  section = false,
}: {
  label: string;
  section?: boolean;
}) {
  if (section) {
    return (
      <div {...stylex.props(styles.sectionContent)}>
        <div {...stylex.props(styles.sectionBody)}>
          <LoadingList label={label} rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.content)}>
      <LoadingList label={label} rows={4} />
    </div>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
  sectionContent: {
    minWidth: 0,
    paddingTop: space.x2,
  },
  sectionBody: {
    marginTop: space.x8,
  },
});
