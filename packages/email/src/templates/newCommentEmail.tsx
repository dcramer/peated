import {
  Button,
  Column,
  Heading,
  Hr,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "jsx-email";
import Layout from "../components/layout";

import theme from "@peated/design";
import {
  defaulted,
  nullable,
  number,
  object,
  string,
  type Infer,
} from "superstruct";

export const TemplateName = "NewCommentEmail";

export const TemplateStruct = object({
  comment: defaulted(
    object({
      id: number(),
      comment: string(),
      tasting: object({
        id: number(),
        bottle: object({
          fullName: string(),
        }),
      }),
      createdBy: object({
        username: string(),
        pictureUrl: nullable(string()),
      }),
    }),
    {
      id: 1,
      comment:
        "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).",
      tasting: {
        id: 2,
        bottle: {
          fullName: "Macallan 12-year-old",
        },
      },
      createdBy: {
        username: "jane.doe",
        pictureUrl: null,
      },
    },
  ),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ comment, baseUrl }: TemplateProps) => {
  const tastingUrl = `${baseUrl}/tastings/${comment.tasting.id}`;
  const commentUrl = `${tastingUrl}#c_${comment.id}`;
  const settingsUrl = `${baseUrl}/settings`;
  const profileUrl = `${baseUrl}/users/${encodeURIComponent(comment.createdBy.username)}`;
  const avatarUrl =
    comment.createdBy.pictureUrl || `${baseUrl}/assets/default-avatar.png`;

  const previewText = `New Comment from ${comment.createdBy.username}`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section
        style={{
          marginBottom: "16px",
          padding: "16px 24px 0",
        }}
      >
        <Row>
          <Column
            style={{
              width: "64px",
              paddingRight: "16px",
            }}
          >
            <Img
              style={{ borderRadius: "9999px" }}
              src={avatarUrl}
              width="64px"
              height="64px"
            />
          </Column>
          <Column>
            <Heading
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: "normal",
                color: theme.colors.white,
              }}
            >
              <Link
                href={profileUrl}
                disableDefaultStyle
                style={{
                  fontWeight: "bold",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                {comment.createdBy.username}
              </Link>{" "}
              commented on{" "}
              <Link
                href={tastingUrl}
                disableDefaultStyle
                style={{
                  fontWeight: "bold",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                {comment.tasting.bottle.fullName}
              </Link>
            </Heading>
          </Column>
        </Row>
      </Section>

      <Section
        style={{
          marginBottom: "16px",
          padding: "16px 24px 0",
        }}
      >
        <Text
          style={{
            margin: 0,
            padding: 0,
            fontSize: "14px",
            lineHeight: "24px",
            color: theme.colors.white,
          }}
        >
          {comment.comment}
        </Text>
      </Section>

      <Section
        style={{
          marginBottom: "16px",
          padding: "16px 24px 0",
          textAlign: "center",
        }}
      >
        <Button
          style={{
            border: `1px solid ${theme.colors.highlight}`,
            backgroundColor: theme.colors.highlight,
            borderRadius: "4px",
            padding: "12px",
            textAlign: "center",
            fontSize: "14px",
            fontWeight: "500",
            color: theme.colors.black,
            textDecoration: "none",
          }}
          href={commentUrl}
        >
          View Comment
        </Button>
      </Section>

      <Section
        style={{
          marginBottom: "8px",
          padding: "16px 24px 0",
          textAlign: "center",
        }}
      >
        <Hr
          disableDefaultStyle
          style={{
            width: "100%",
            margin: 0,
            border: `1px solid ${theme.colors.slate[700]}`,
          }}
        />
      </Section>

      <Section
        style={{
          marginBottom: "16px",
          padding: "16px 24px 0",
          textAlign: "center",
        }}
      >
        <Text
          disableDefaultStyle
          style={{
            margin: 0,
            padding: 0,
            fontSize: "14px",
            lineHeight: "24px",
            color: theme.colors.muted,
          }}
        >
          You are being notified because you are subscribed to comments.{" "}
          <Link
            disableDefaultStyle
            href={settingsUrl}
            style={{
              color: theme.colors.muted,
              textDecoration: "underline",
            }}
          >
            Settings
          </Link>
        </Text>
      </Section>
    </Layout>
  );
};
