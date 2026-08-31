import * as stylex from "@stylexjs/stylex";

import { AppLink, type AppLinkProps } from "./appLink";
import { textLinkStyles } from "./textLinkStyles.stylex";
import { getTextTitle } from "./textTitle";

export type TextLinkProps = Omit<
  AppLinkProps,
  "href" | "className" | "style"
> & {
  href: string;
  size?: "inherit" | "sm";
  truncate?: boolean;
};

/** Uses the shared inline-link interaction treatment. */
export function TextLink({
  children,
  href,
  size = "sm",
  truncate = false,
  ...props
}: TextLinkProps) {
  return (
    <AppLink
      href={href}
      {...props}
      {...stylex.props(
        textLinkStyles.link,
        size === "sm" && textLinkStyles.small,
        truncate && textLinkStyles.truncate,
      )}
    >
      {truncate ? (
        <span
          title={getTextTitle(children)}
          {...stylex.props(textLinkStyles.truncateContent)}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </AppLink>
  );
}
