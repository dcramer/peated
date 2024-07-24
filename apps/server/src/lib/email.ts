import theme from "@peated/design";
import config from "@peated/server/config";
import { and, eq, inArray, ne } from "drizzle-orm";
import mjml2html from "mjml";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { db } from "../db";
import {
  comments,
  users,
  type Bottle,
  type Comment,
  type Tasting,
  type User,
} from "../db/schema";
import { logError } from "../lib/log";
import { absoluteUri } from "./urls";

let mailTransport: Transporter<SMTPTransport.SentMessageInfo>;

type CommentWithRelations = Comment & {
  createdBy: User;
  tasting: Tasting & {
    bottle: Bottle;
    createdBy: User;
  };
};

const hasEmailSupport = () => {
  if (!config.URL_PREFIX) {
    logError("URL_PREFIX is not configured");
    return false;
  }

  if (!config.SMTP_FROM) {
    logError("SMTP_FROM is not configured");
    return false;
  }

  return true;
};

const createMailTransport = () => {
  const user = config.SMTP_USER;
  const auth = user
    ? {
        user,
        pass: config.SMTP_PASS,
      }
    : undefined;

  return createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: true,
    auth,
  } satisfies SMTPTransport.Options);
};

// TODO: this should be an abstraction of the notification system
export async function notifyComment({
  comment,
  transport = mailTransport,
}: {
  comment: CommentWithRelations;
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  if (!hasEmailSupport()) return;

  // dont notify self
  if (comment.createdById === comment.tasting.createdById) return;

  const userIds =
    comment.createdById === comment.tasting.createdById
      ? []
      : [comment.tasting.createdById];
  userIds.push(
    ...(
      await db
        .selectDistinct({ id: comments.createdById })
        .from(comments)
        .where(
          and(
            eq(comments.tastingId, comment.tasting.id),
            ne(comments.createdById, comment.tasting.createdById),
            ne(comments.createdById, comment.createdById),
          ),
        )
    ).map((r) => r.id),
  );

  const emailList = (
    await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          inArray(users.id, Array.from(new Set(userIds))),
          eq(users.notifyComments, true),
        ),
      )
  ).map((r) => r.email);

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const commentUrl = `${config.URL_PREFIX}/tastings/${comment.tasting.id}#c_${comment.id}`;
  const html = buildCommentHtml(comment);

  console.log(
    `Sending email notification for comment ${comment.id} to ${comment.tasting.createdBy.email}`,
  );

  for (const email of emailList) {
    try {
      await transport.sendMail({
        from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM}>`,
        to: email,
        subject: "New Comment on Tasting",
        text: `View this comment on Peated: ${commentUrl}\n\n${comment.comment}`,
        html,
        replyTo: `"${config.SMTP_FROM_NAME}" <${config.SMTP_REPLY_TO || config.SMTP_FROM}>`,
      });
    } catch (err) {
      logError(err);
    }
  }
}

export function buildCommentHtml(comment: {
  id: number;
  comment: string;
  tasting: {
    id: number;
    bottle: {
      fullName: string;
    };
  };
  createdBy: {
    username: string;
    pictureUrl: string | null;
  };
}): string {
  const commentUrl = absoluteUri(
    `/tastings/${comment.tasting.id}#c_${comment.id}`,
    config.URL_PREFIX,
  );
  const settingsUrl = absoluteUri(`/settings`, config.URL_PREFIX);
  const profileUrl = absoluteUri(
    `/users/${encodeURIComponent(comment.createdBy.username)}`,
    config.URL_PREFIX,
  );
  const avatarUrl =
    comment.createdBy.pictureUrl ||
    `${config.URL_PREFIX}/assets/placeholder-avatar.png`;

  const input = `
  <mjml>
  <mj-head>
    <mj-attributes>
      <mj-text align="center" font-size="14px" line-height="24px" color="${theme.colors.black}" padding="0" />
      <mj-button font-size="14px" color="${theme.colors.white}" background-color="${theme.colors.slate[700]}" />
      <mj-section background-color="${theme.colors.white}" margin-bottom="24px" full-width="full-width" text-align="center" padding="24px 16px 0" vertical-align="center" />
      <mj-image padding="0" />
    </mj-attributes>
  </mj-head>

  <mj-body background-color="${theme.colors.slate[100]}" color="${theme.colors.black}" font-family="Arial, sans-serif">
    <mj-wrapper padding="40px 0">  
      <mj-wrapper padding="0" full-width="full-width" text-align="center">
        <mj-section background-color="${theme.colors.slate[800]}" padding="32px 16px">
          <mj-column vertical-align="center" width="96px">
            <mj-image href="${config.URL_PREFIX}" src="${config.URL_PREFIX}/assets/glyph.png" />
          </mj-column>
        </mj-section>
        
        <mj-section>
          <mj-column width="20%" padding-right="20px">
            <mj-image src=${avatarUrl}" width="64px" />
          </mj-column>
          <mj-column width="80%">
            <mj-text align="left" font-size="24px" line-height="28px">
              <a href="${profileUrl}" style="color:inherit;text-decoration:none;"><strong>${comment.createdBy.username}</strong></a> commented on <a href="${commentUrl}" style="color:inherit;text-decoration:none;"><strong>${comment.tasting.bottle.fullName}</strong></a>
            </mj-text>
          </mj-column>
        </mj-section>

        <mj-section>
          <mj-column>
            <mj-text align="justify">${comment.comment}</mj-text>
          </mj-column>
        </mj-section>

        <mj-section>
          <mj-column>
            <mj-button align="center" href="${commentUrl}">View Comment</mj-button>
          </mj-column>
        </mj-section>

        <mj-section>
          <mj-divider border-wdith="1px" border-style="solid" border-color="${theme.colors.slate[100]}" />
        </mj-section>

        <mj-section padding="20px 10px" >
          <mj-text color="${theme.colors.slate[500]}">
            You are being notified because you are subscribed to comments. <a href="${settingsUrl}" style="color:${theme.colors.slate[800]};text-decoration:underline">Settings</a>
          </mj-text>
        </mj-section>
      </mj-wrapper>
    </mj-wrapper>
  </mj-body>
</mjml>
  `;

  const { html } = mjml2html(input);
  return html;
}
