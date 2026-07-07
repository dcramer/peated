import config from "@peated/server/config";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { notifyComment, sendMagicLinkEmail } from "./email";

let transport: Transporter<SMTPTransport.SentMessageInfo>;
let outbox: Mail.Options[];

// const mailConfig = {
//   to: "test@example.com",
// };

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
  config.SMTP_HOST = "localhost";
  config.SMTP_FROM = "example@example.com";

  const harness = createEmailTestHarness();
  transport = harness.transport;
  outbox = harness.outbox;
});

describe("notifyComment", () => {
  test("doesnt notify author", async ({ fixtures }) => {
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
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

  test("constructs appropriate email", async ({ fixtures }) => {
    const otherAuthor = await fixtures.User({
      verified: true,
    });
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
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

describe("sendMagicLinkEmail", () => {
  test("requires SendGrid SMTP credentials", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const originalHost = config.SMTP_HOST;
    const originalUser = config.SMTP_USER;
    const originalPass = config.SMTP_PASS;

    config.SMTP_HOST = "smtp.sendgrid.net";
    config.SMTP_USER = undefined;
    config.SMTP_PASS = undefined;

    try {
      await expect(sendMagicLinkEmail({ user, transport })).rejects.toThrow(
        "SMTP credentials are not configured",
      );
      expect(outbox.length).toBe(0);
    } finally {
      config.SMTP_HOST = originalHost;
      config.SMTP_USER = originalUser;
      config.SMTP_PASS = originalPass;
    }
  });
});
