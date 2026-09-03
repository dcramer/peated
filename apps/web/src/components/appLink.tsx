import { foundationStyles } from "@peated/web/styles/foundations.stylex";
import * as stylex from "@stylexjs/stylex";
import NextLink from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ForwardedRef,
} from "react";

import { textLinkStyles } from "./textLinkStyles.stylex";

export type AppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  prefetch?: boolean | null;
};

export function isInternalAppHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Uses client navigation for app routes and native anchors for other targets.
 * A bare link gets the shared text-link interaction treatment. Composite
 * components replace it by supplying their own class. Use TextLink for inline
 * text because its API also owns typography and truncation.
 */
export const AppLink = forwardRef(function AppLink(
  {
    children,
    className,
    download,
    href,
    prefetch = false,
    style,
    ...props
  }: AppLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  const fallbackProps = className
    ? undefined
    : stylex.props(textLinkStyles.link, foundationStyles.interactiveSmall);
  const linkProps = {
    ...props,
    className: className ?? fallbackProps?.className,
    style: fallbackProps?.style ? { ...fallbackProps.style, ...style } : style,
  };

  if (!href || !isInternalAppHref(href) || download !== undefined) {
    return (
      <a {...linkProps} download={download} href={href} ref={ref}>
        {children}
      </a>
    );
  }

  return (
    <NextLink {...linkProps} href={href} prefetch={prefetch} ref={ref}>
      {children}
    </NextLink>
  );
});
