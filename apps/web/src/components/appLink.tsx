import NextLink from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ForwardedRef,
} from "react";

export type AppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  prefetch?: boolean;
};

export function isInternalAppHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

/** Uses client navigation for app routes and native anchors for other targets. */
export const AppLink = forwardRef(function AppLink(
  { children, download, href, prefetch = false, ...props }: AppLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  if (!href || !isInternalAppHref(href) || download !== undefined) {
    return (
      <a {...props} download={download} href={href} ref={ref}>
        {children}
      </a>
    );
  }

  return (
    <NextLink {...props} href={href} prefetch={prefetch} ref={ref}>
      {children}
    </NextLink>
  );
});
