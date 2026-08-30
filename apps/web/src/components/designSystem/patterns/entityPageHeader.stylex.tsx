import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { space } from "../../../styles/tokens.stylex";
import {
  hasVisibleSpecStripCells,
  RecordId,
  SpecStrip,
  type SpecStripCells,
} from "../components";
import { PageHeader } from "./pageLayout.stylex";

export type EntityPageHeaderProps = {
  actions?: ReactNode;
  description?: ReactNode;
  detail?: string;
  eyebrow?: ReactNode;
  id: string;
  menu?: ReactNode;
  parent?: ReactNode;
  specs: SpecStripCells;
  title: ReactNode;
};

/** Presents one entity's supplied identity, actions, and core catalog facts. */
export function EntityPageHeader({
  actions,
  description,
  detail,
  eyebrow,
  id,
  menu,
  parent,
  specs,
  title,
}: EntityPageHeaderProps) {
  return (
    <div>
      <PageHeader
        actions={actions}
        description={description}
        eyebrow={eyebrow}
        identity={<RecordId detail={detail} id={id} />}
        menu={menu}
        parent={parent}
        title={title}
      />
      {hasVisibleSpecStripCells(specs) ? (
        <div {...stylex.props(styles.specs)}>
          <SpecStrip cells={specs} />
        </div>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  specs: {
    marginTop: space.x3,
  },
});
