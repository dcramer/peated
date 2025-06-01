import { Preview } from "jsx-email";
import React from "react";
import { type Infer, defaulted, object, string } from "superstruct";
import { Button, Link, Section, Text } from "../components/core";
import Layout from "../components/layout";
import { colors } from "../constants";

export const TemplateName = "PasswordResetEmail";

export const TemplateStruct = object({
  resetUrl: defaulted(string(), "https://peated.com/reset-password"),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ resetUrl, baseUrl }: TemplateProps) => {
  const previewText = "A password reset was requested.";

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Text>
          A password reset was requested for your account on{" "}
          <Link
            href={baseUrl}
            disableDefaultStyle
            style={{
              color: colors.highlight,
              textDecoration: "underline",
            }}
          >
            <strong>Peated</strong>
          </Link>
          .
        </Text>
      </Section>

      <Section>
        <Button href={resetUrl}>Reset Password</Button>
      </Section>

      <Section>
        <Text
          style={{
            color: colors.muted,
          }}
        >
          If you don't recognize this action, you should ignore this email.
        </Text>
      </Section>
    </Layout>
  );
};
