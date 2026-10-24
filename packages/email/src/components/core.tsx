import {
  Button as DefaultButton,
  Heading as DefaultHeading,
  Hr as DefaultHr,
  Link as DefaultLink,
  Section as DefaultSection,
  Text as DefaultText,
} from "jsx-email";
import type { ComponentProps } from "react";
import React from "react";
import theme from "../theme";

export function Section({
  style = {},
  ...props
}: ComponentProps<typeof DefaultSection>) {
  return (
    <DefaultSection
      style={{
        marginBottom: "16px",
        padding: "16px 24px 0",
        textAlign: "center",
        ...style,
      }}
      {...props}
    />
  );
}

export function Hr({ style = {}, ...props }: ComponentProps<typeof DefaultHr>) {
  return (
    <DefaultHr
      disableDefaultStyle
      style={{
        width: "100%",
        margin: 0,
        border: `1px solid ${theme.colors.slate[700]}`,
        ...style,
      }}
      {...props}
    />
  );
}

export function Text({
  style = {},
  ...props
}: ComponentProps<typeof DefaultText>) {
  return (
    <DefaultText
      style={{
        margin: 0,
        padding: 0,
        fontSize: "14px",
        lineHeight: "24px",
        color: theme.colors.white,
        ...style,
      }}
      {...props}
    />
  );
}

type ButtonProps = Omit<
  ComponentProps<typeof DefaultButton>,
  "width" | "height"
> &
  Partial<Pick<ComponentProps<typeof DefaultButton>, "width" | "height">>;

// jsx-email sizes buttons from width and height so Outlook can draw them.
export function Button({
  style = {},
  width = 200,
  height = 44,
  ...props
}: ButtonProps) {
  return (
    <DefaultButton
      width={width}
      height={height}
      align="center"
      backgroundColor={theme.colors.highlight}
      borderColor={theme.colors.highlight}
      borderRadius={4}
      fontSize={14}
      textColor={theme.colors.black}
      style={{
        fontWeight: "500",
        ...style,
      }}
      {...props}
    />
  );
}

export function Link({
  style = {},
  ...props
}: ComponentProps<typeof DefaultLink>) {
  return (
    <DefaultLink
      disableDefaultStyle
      style={{
        color: theme.colors.highlight,
        textDecoration: "underline",
        ...style,
      }}
      {...props}
    />
  );
}

export function Heading({
  style = {},
  ...props
}: ComponentProps<typeof DefaultHeading>) {
  return (
    <DefaultHeading
      style={{
        margin: 0,
        fontSize: "24px",
        fontWeight: "normal",
        color: theme.colors.white,
        textAlign: "left",
        ...style,
      }}
      {...props}
    />
  );
}
