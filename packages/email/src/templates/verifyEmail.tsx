import { Preview } from "jsx-email";
import { type Infer, defaulted, object, string } from "superstruct";
import { Button, Link, Section, Text } from "../components/core";
import Layout from "../components/layout";
import { colors } from "../constants";

export const TemplateName = "VerifyEmail";

export const TemplateStruct = object({
  verifyUrl: defaulted(string(), "https://peated.com/verify"),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ verifyUrl, baseUrl }: TemplateProps) => {
  const previewText = "Your email address requires verification.";

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Text>
          Your email address was used to create an account on{" "}
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
          . To continue you'll need to verify this address.
        </Text>
      </Section>

      <Section>
        <Button href={verifyUrl}>Verify Account</Button>
      </Section>

      <Section>
        <Text
          style={{
            color: colors.muted,
          }}
        >
          If you didn't take this action, you may ignore this email.
        </Text>
      </Section>
    </Layout>
  );
};
