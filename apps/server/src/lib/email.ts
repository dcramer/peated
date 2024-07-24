import config from "@peated/server/config";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  comments,
  users,
  type Bottle,
  type Comment,
  type Tasting,
  type User,
} from "../db/schema";
import { logError } from "../lib/log";
import { escapeHtml } from "./html";

import theme from "@peated/design";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
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
  const avatarUrl = absoluteUri(
    comment.createdBy.pictureUrl ||
      `${config.URL_PREFIX}/assets/placeholder-avatar.png`,
    config.API_SERVER,
  );

  const titleLine = `${escapeHtml(
    comment.createdBy.username,
  )} commented on ${comment.tasting.bottle.fullName}`;
  const reasonLine = `You are being notified because you are subscribed to comments. <a href="${settingsUrl}" style="color:${theme.colors.highlight}">Settings</a>`;

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>New Comment</title>
      <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
    </head>
    <body style="width:100%">
    <table style="width:100%;">
    <tr><td style="width:100%;text-align:center;">
    <table style="width:600px;margin:0 auto;"><tr><td style="text-align:left;background:${theme.colors.background};border-radius:8px;padding:12px 16px;border:1px solid ${theme.colors.slate[900]};">
      <h2 style="margin-top:0;margin-bottom:15px;color:${
        theme.colors.highlight
      };">${titleLine}</h2>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:top"><img src="${avatarUrl}" width="36" height="36" style="border-radius:36px;display:block;" /></td>
          <td style="padding-left:15px">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><b style="color:${theme.colors.highlight};"><a href="${profileUrl}" style="color:${theme.colors.highlight};">${escapeHtml(
                  comment.createdBy.username,
                )}</a></b></td>
              </tr>
              <tr>
              <td style="color:${theme.colors.light};">${escapeHtml(
                comment.comment,
              )}</td>
            </tr>
            <tr>
              <td style="padding-top:15px;"><a href="${commentUrl}" style="color:${
                theme.colors.highlight
              };">View this Comment</a></td>
            </tr>
            </table>
        </tr>
      </table>
      <p style="color:${theme.colors.light};margin:15px 0 0;">${reasonLine}</p>
      </td></tr></table>
      </td></tr></table>
    </body>
  </html>
  `;
}
