import config from "@peated/server/config";
import type { Bottle, Comment, Tasting, User } from "@peated/server/db/schema";
import * as Fixtures from "@peated/server/lib/test/fixtures";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { notifyComment } from "./email";

let transport: Transporter<SMTPTransport.SentMessageInfo>;
let outbox: Mail.Options[];

const mailConfig = {
  to: "test@example.com",
};

const createEmailTestHarness = () => {
  const outbox: Mail.Options[] = [];
  const testTransport: SMTPTransport | SMTPTransport.Options = {
    name: "test",
    version: "0.1.0",
    send: (mail, callback) => {
      const input = mail.message.createReadStream();
      const envelope = mail.message.getEnvelope();
      const messageId = mail.message.messageId();

      input.on("readable", () => {
        input.read();
      });
      input.on("end", function () {
        const info = {
          envelope,
          messageId,
          accepted: [],
          rejected: [],
          pending: [],
          response: "ok",
        };
        callback(null, info);
      });

      outbox.push(mail.data);
    },
  };

  return {
    transport: createTransport(testTransport),
    outbox: outbox,
  };
};

beforeEach(async () => {
  config.API_SERVER = "http://localhost";
  config.SMTP_FROM = "vanguard@example.com";

  const harness = createEmailTestHarness();
  transport = harness.transport;
  outbox = harness.outbox;
});

describe("notifyComment", () => {
  let author: User;
  let bottle: Bottle;
  let tasting: Tasting;
  let comment: Comment;

  beforeEach(async () => {
    author = await Fixtures.User({
      email: "joe@example.com",
    });
    bottle = await Fixtures.Bottle();
    tasting = await Fixtures.Tasting({
      bottleId: bottle.id,
      createdById: author.id,
    });
  });

  test("doesnt notify author", async () => {
    comment = await Fixtures.Comment({
      comment: "**An Comment** on _life_",
      createdById: author.id,
    });

    await notifyComment({
      comment: {
        ...comment,
        createdBy: author,
        tasting: {
          ...tasting,
          bottle,
          createdBy: author,
        },
      },
      transport,
    });
    expect(outbox.length).toBe(0);
  });

  test("constructs appropriate email", async () => {
    const otherAuthor = await Fixtures.User();
    comment = await Fixtures.Comment({
      comment: "**An Comment** on _life_",
      createdById: otherAuthor.id,
    });

    await notifyComment({
      comment: {
        ...comment,
        createdBy: otherAuthor,
        tasting: {
          ...tasting,
          bottle,
          createdBy: author,
        },
      },
      transport,
    });
    expect(outbox.length).toBe(1);
    const msg = outbox[0];
    expect(msg.to).toBe(author.email);
    expect(msg.subject).toBe("New Comment on Tasting");
  });
});
