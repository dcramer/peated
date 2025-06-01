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
import { colors } from "../constants";

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
        border: `1px solid ${colors.slate[700]}`,
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
        color: colors.white,
        ...style,
      }}
      {...props}
    />
  );
}

export function Button({
  style = {},
  ...props
}: ComponentProps<typeof DefaultButton>) {
  return (
    <DefaultButton
      style={{
        border: `1px solid ${colors.highlight}`,
        backgroundColor: colors.highlight,
        borderRadius: "4px",
        padding: "12px",
        textAlign: "center",
        fontSize: "14px",
        fontWeight: "500",
        color: colors.black,
        textDecoration: "none",
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
        color: colors.highlight,
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
        color: colors.white,
        textAlign: "left",
        ...style,
      }}
      {...props}
    />
  );
}
