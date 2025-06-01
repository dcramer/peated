import { Column, Img, Preview, Row } from "jsx-email";
import React from "react";
import {
  type Infer,
  defaulted,
  nullable,
  number,
  object,
  string,
} from "superstruct";
import { Button, Heading, Hr, Link, Section, Text } from "../components/core";
import Layout from "../components/layout";
import ReasonFooter, { Reason } from "../components/reasonFooter";

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
    }
  ),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ comment, baseUrl }: TemplateProps) => {
  const tastingUrl = `${baseUrl}/tastings/${comment.tasting.id}`;
  const commentUrl = `${tastingUrl}#c_${comment.id}`;
  const profileUrl = `${baseUrl}/users/${encodeURIComponent(comment.createdBy.username)}`;
  const avatarUrl =
    comment.createdBy.pictureUrl || `${baseUrl}/assets/default-avatar.png`;

  const previewText = `New Comment from ${comment.createdBy.username}`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Row>
          <Column
            style={{
              width: "64px",
              paddingRight: "16px",
            }}
          >
            <Link href={profileUrl}>
              <Img
                style={{ borderRadius: "9999px" }}
                src={avatarUrl}
                width="64px"
                height="64px"
              />
            </Link>
          </Column>
          <Column>
            <Heading>
              <Link
                href={profileUrl}
                style={{
                  fontWeight: "bold",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                {comment.createdBy.username}
              </Link>{" "}
              commented on
            </Heading>
            <Heading>
              <Link
                href={tastingUrl}
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

      <Section>
        <Text>{comment.comment}</Text>
      </Section>

      <Section>
        <Button href={commentUrl}>View Comment</Button>
      </Section>

      <Section>
        <Hr />
      </Section>

      <ReasonFooter reason={Reason.comments} baseUrl={baseUrl} />
    </Layout>
  );
};
