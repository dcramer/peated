import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../styles/tokens.stylex";
import { AppLink, type AppLinkProps } from "./appLink";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

export type ButtonVariant = "default" | "tonal" | "accent" | "danger" | "text";
export type ButtonSize = "sm" | "md" | "lg";

type SharedButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style"
> & {
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export type ButtonProps = SharedButtonProps & {
  align?: "center" | "start";
  fullWidth?: boolean;
  loadingLabel?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      align = "center",
      children,
      disabled = false,
      fullWidth = false,
      loading = false,
      loadingLabel,
      size = "md",
      type = "button",
      variant = "default",
      ...props
    },
    ref,
  ) {
    return (
      <ButtonBase
        {...props}
        align={align}
        disabled={disabled}
        fullWidth={fullWidth}
        layout="label"
        loading={loading}
        ref={ref}
        size={size}
        type={type}
        variant={variant}
      >
        {loading && loadingLabel !== undefined ? loadingLabel : children}
      </ButtonBase>
    );
  },
);

export type ButtonLinkProps = Omit<AppLinkProps, "className" | "style"> & {
  align?: "center" | "start";
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

/** Uses the button treatment for navigation without hiding its link semantics. */
export function ButtonLink({
  align = "center",
  children,
  fullWidth = false,
  size = "md",
  variant = "default",
  ...props
}: ButtonLinkProps) {
  return (
    <AppLink
      {...props}
      data-size={size}
      data-variant={variant}
      {...stylex.props(
        foundationStyles.interactive,
        styles.control,
        styles.button,
        styles.link,
        fullWidth && styles.fullWidth,
        align === "start" && styles.alignStart,
        controlSizeStyles[size],
        buttonSizeStyles[size],
        variantStyles[variant],
      )}
    >
      {children}
    </AppLink>
  );
}

export type IconButtonProps = Omit<
  SharedButtonProps,
  "aria-label" | "children"
> & {
  icon: ReactNode;
  label: string;
  /** Removes the frame and fill so the parent surface shows through. */
  mergeWithSurface?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon, label, mergeWithSurface = false, variant = "tonal", ...props },
    ref,
  ) {
    return (
      <ButtonBase
        {...props}
        aria-label={label}
        layout="icon"
        mergeWithSurface={mergeWithSurface}
        ref={ref}
        variant={variant}
      >
        {icon}
      </ButtonBase>
    );
  },
);

type ButtonBaseProps = SharedButtonProps & {
  align?: "center" | "start";
  children: ReactNode;
  fullWidth?: boolean;
  layout: "icon" | "label";
  mergeWithSurface?: boolean;
};

/** Owns label and icon control sizing, native states, and keyboard feedback. */
const ButtonBase = forwardRef<HTMLButtonElement, ButtonBaseProps>(
  function ButtonBase(
    {
      align = "center",
      children,
      disabled = false,
      fullWidth = false,
      layout,
      loading = false,
      mergeWithSurface = false,
      size = "md",
      type = "button",
      variant = "default",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        aria-busy={loading || undefined}
        data-size={size}
        data-variant={variant}
        disabled={disabled || loading}
        ref={ref}
        type={type}
        {...stylex.props(
          foundationStyles.interactive,
          styles.control,
          layout === "label" && styles.button,
          layout === "icon" && styles.iconButton,
          fullWidth && styles.fullWidth,
          align === "start" && styles.alignStart,
          controlSizeStyles[size],
          layout === "label" && buttonSizeStyles[size],
          layout === "icon" && iconButtonSizeStyles[size],
          variantStyles[variant],
          mergeWithSurface && styles.mergedWithSurface,
          loading && styles.loading,
          loading && variant === "accent" && styles.loadingAccent,
        )}
      >
        {children}
        {loading ? (
          <span aria-hidden {...stylex.props(styles.loadingTrack)}>
            <span {...stylex.props(styles.loadingSweep)} />
          </span>
        ) : null}
      </button>
    );
  },
);

const sweep = stylex.keyframes({
  "0%": { transform: "translateX(-100%)" },
  "100%": { transform: "translateX(300%)" },
});

const styles = stylex.create({
  control: {
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: { default: "none", ":focus-visible": "2px solid currentColor" },
    outlineOffset: "-3px",
    color: colors.ink,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":hover": 0.86,
      ":active": 0.75,
      ":focus-visible": 0.86,
      ":disabled": 0.45,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    transitionProperty: "background-color, color, opacity",
    transitionDuration: { default: "120ms", [REDUCED_MOTION]: "0ms" },
  },
  button: {
    columnGap: space.x2,
    whiteSpace: "nowrap",
  },
  fullWidth: {
    width: "100%",
  },
  alignStart: {
    justifyContent: "flex-start",
    textAlign: "left",
  },
  link: {
    textDecoration: "none",
  },
  iconButton: {
    padding: 0,
  },
  controlSmall: {
    height: controlMetrics.controlHeightSmall,
    fontSize: "13px",
  },
  controlMedium: {
    height: controlMetrics.controlHeight,
    fontSize: "15px",
  },
  controlLarge: {
    height: controlMetrics.controlHeightLarge,
    fontSize: "16px",
  },
  buttonSmall: {
    paddingRight: "12px",
    paddingLeft: "12px",
  },
  buttonMedium: {
    paddingRight: "16px",
    paddingLeft: "16px",
  },
  buttonLarge: {
    paddingRight: "20px",
    paddingLeft: "20px",
  },
  iconButtonSmall: {
    width: controlMetrics.controlHeightSmall,
  },
  iconButtonMedium: {
    width: controlMetrics.controlHeight,
  },
  iconButtonLarge: {
    width: controlMetrics.controlHeightLarge,
  },
  default: {
    backgroundColor: colors.ink,
    color: colors.ground,
  },
  tonal: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.inset,
      ":focus-visible": colors.surface,
    },
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.sectionRule}`,
      ":focus-visible": `inset 0 0 0 1px ${colors.sectionRule}`,
    },
    color: colors.ink,
  },
  accent: {
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  danger: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.criticalQuiet,
      ":active": colors.criticalQuiet,
      ":focus-visible": colors.criticalQuiet,
    },
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.critical}`,
      ":focus-visible": `inset 0 0 0 1px ${colors.critical}`,
    },
    color: colors.critical,
  },
  text: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.accentTint,
      ":active": colors.accentTint,
      ":focus-visible": colors.accentTint,
    },
    color: colors.accentDeep,
  },
  mergedWithSurface: {
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
      ":focus-visible": colors.accentDeep,
    },
    backgroundColor: {
      default: "transparent",
      ":hover": "transparent",
      ":active": "transparent",
    },
    opacity: {
      default: 1,
      ":hover": 1,
      ":active": 1,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
  },
  loading: {
    position: "relative",
    overflow: "hidden",
    cursor: { default: "wait", ":disabled": "wait" },
    opacity: { default: 1, ":hover": 1, ":disabled": 1 },
  },
  loadingAccent: {
    backgroundColor: colors.accentDeep,
  },
  loadingTrack: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "2px",
    overflow: "hidden",
  },
  loadingSweep: {
    display: "block",
    width: "33%",
    height: "2px",
    backgroundColor: "currentColor",
    animationName: { default: sweep, [REDUCED_MOTION]: "none" },
    animationDuration: "1.15s",
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    animationIterationCount: "infinite",
  },
});

const variantStyles = {
  default: styles.default,
  tonal: styles.tonal,
  accent: styles.accent,
  danger: styles.danger,
  text: styles.text,
} satisfies Record<ButtonVariant, stylex.StyleXStyles>;

const controlSizeStyles = {
  sm: styles.controlSmall,
  md: styles.controlMedium,
  lg: styles.controlLarge,
} satisfies Record<ButtonSize, stylex.StyleXStyles>;

const buttonSizeStyles = {
  sm: styles.buttonSmall,
  md: styles.buttonMedium,
  lg: styles.buttonLarge,
} satisfies Record<ButtonSize, stylex.StyleXStyles>;

const iconButtonSizeStyles = {
  sm: styles.iconButtonSmall,
  md: styles.iconButtonMedium,
  lg: styles.iconButtonLarge,
} satisfies Record<ButtonSize, stylex.StyleXStyles>;
