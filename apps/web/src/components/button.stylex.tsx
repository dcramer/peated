import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink, type AppLinkProps } from "./appLink";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

export type ButtonVariant = "default" | "tonal" | "accent" | "danger" | "text";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style"
> & {
  align?: "center" | "start";
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
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
      <button
        {...props}
        aria-busy={loading || undefined}
        data-size={size}
        data-variant={variant}
        disabled={disabled || loading}
        ref={ref}
        type={type}
        {...stylex.props(
          styles.control,
          styles.button,
          fullWidth && styles.fullWidth,
          align === "start" && styles.alignStart,
          controlSizeStyles[size],
          buttonSizeStyles[size],
          variantStyles[variant],
          loading && styles.loading,
          loading && variant === "accent" && styles.loadingAccent,
        )}
      >
        {loading && loadingLabel !== undefined ? loadingLabel : children}
        {loading ? (
          <span aria-hidden {...stylex.props(styles.loadingTrack)}>
            <span {...stylex.props(styles.loadingSweep)} />
          </span>
        ) : null}
      </button>
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
  ButtonProps,
  "aria-label" | "children" | "loadingLabel"
> & {
  icon: ReactNode;
  label: string;
};

export function IconButton({
  icon,
  label,
  loading = false,
  size = "md",
  variant = "tonal",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      aria-label={label}
      data-size={size}
      data-variant={variant}
      disabled={props.disabled || loading}
      type={props.type ?? "button"}
      {...stylex.props(
        styles.control,
        styles.iconButton,
        controlSizeStyles[size],
        iconButtonSizeStyles[size],
        variantStyles[variant],
        loading && styles.loading,
      )}
    >
      {icon}
      {loading ? (
        <span aria-hidden {...stylex.props(styles.loadingTrack)}>
          <span {...stylex.props(styles.loadingSweep)} />
        </span>
      ) : null}
    </button>
  );
}

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
    outline: "none",
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":hover": 0.86,
      ":disabled": 0.45,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    transform: {
      default: "none",
      ":active": "translateY(1px)",
      ":disabled": "none",
    },
    transitionProperty: "background-color, color, opacity, transform",
    transitionDuration: "120ms",
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
    },
    boxShadow: `inset 0 0 0 1px ${colors.sectionRule}`,
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
    },
    boxShadow: `inset 0 0 0 1px ${colors.critical}`,
    color: colors.critical,
  },
  text: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.accentTint,
    },
    color: colors.accentDeep,
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
