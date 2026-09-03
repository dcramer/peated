import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { KeyFacts, PeatedId, hasVisibleKeyFacts, type KeyFactList } from "..";
import { space } from "../../styles/tokens.stylex";
import { PageHeader } from "./pageLayout.stylex";

export type EntityPageHeaderProps = {
  actions?: ReactNode;
  description?: ReactNode;
  detail?: string;
  metadata?: ReactNode;
  id: string;
  menu?: ReactNode;
  parent?: ReactNode;
  specs: KeyFactList;
  title: ReactNode;
};

/** Presents one entity's supplied identity, actions, and core catalog facts. */
export function EntityPageHeader({
  actions,
  description,
  detail,
  metadata,
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
        actionsPosition="start"
        description={description}
        metadata={metadata}
        identity={<PeatedId detail={detail} id={id} />}
        menu={menu}
        parent={parent}
        title={title}
      />
      {hasVisibleKeyFacts(specs) ? (
        <div {...stylex.props(styles.specs)}>
          <KeyFacts facts={specs} />
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
