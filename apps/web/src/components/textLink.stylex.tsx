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
  tone?: "accent" | "muted";
};

/** Shared inline link. Use muted for supporting references; its underline stays visible. */
export function TextLink({
  children,
  href,
  size = "sm",
  truncate = false,
  tone = "accent",
  ...props
}: TextLinkProps) {
  return (
    <AppLink
      href={href}
      {...props}
      {...stylex.props(
        textLinkStyles.link,
        size === "sm" && textLinkStyles.small,
        tone === "muted" && textLinkStyles.muted,
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
