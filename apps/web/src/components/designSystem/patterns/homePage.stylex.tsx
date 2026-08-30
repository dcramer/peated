import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { space } from "../../../styles/tokens.stylex";
import { PublicHomeIntro } from "./homeSections.stylex";

export type HomePageProps = {
  content: ReactNode;
  description: ReactNode;
  search: ReactNode;
  title: ReactNode;
};

/** Owns homepage hierarchy and responsive layout, not product data or behavior. */
export function HomePage(props: HomePageProps) {
  return (
    <>
      <PublicHomeIntro
        description={props.description}
        search={props.search}
        title={props.title}
      />
      <div {...stylex.props(styles.publicContent)}>
        <div {...stylex.props(styles.publicMain)}>{props.content}</div>
      </div>
    </>
  );
}

const styles = stylex.create({
  publicContent: {
    paddingBottom: space.x12,
  },
  publicMain: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x12,
  },
});
