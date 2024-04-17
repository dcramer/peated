import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { logError } from "@peated/server/lib/log";
import { formatColor } from "../lib/format";

function absoluteUri(url: string, host: string) {
  if (url.indexOf("https://") === 0 || url.indexOf("http://") === 0) return url;
  return `${host}${url}`;
}

export default async function ({ tastingId }: { tastingId: number }) {
  if (!config.DISCORD_WEBHOOK) {
    throw new Error("DISCORD_WEBHOOK is not configured");
  }

  const tasting = await db.query.tastings.findFirst({
    where: (tastings, { eq }) => eq(tastings.id, tastingId),
    with: {
      createdBy: true,
      bottle: true,
    },
  });
  if (!tasting) {
    throw new Error(`Unknown tasting: ${tastingId}`);
  }

  // TODO: pretty sure we're mismatched timezones on db + server, and need normalization
  // move db to UTC (if its not, or if its not storing tzinfo), and then run all these checks
  // against UTC time
  // if (Math.abs(new Date().getTime() - tasting.createdAt.getTime()) > 300) {
  //   throw new Error("Tasting is too old; Not notifying");
  // }

  const fields = [];
  if (tasting.rating !== null)
    fields.push({
      name: "Rating",
      value: `${tasting.rating}`,
      inline: true,
    });

  if (tasting.tags)
    fields.push({
      name: "Notes",
      value: tasting.tags.join(", "),
      inline: true,
    });

  if (tasting.servingStyle)
    fields.push({
      name: "Serving Style",
      value: tasting.servingStyle,
      inline: true,
    });

  if (tasting.color)
    fields.push({
      name: "Color",
      value: formatColor(tasting.color),
      inline: true,
    });

  const payload = {
    username: "Peated",
    embeds: [
      {
        author: {
          name: tasting.createdBy.username,
          url: `${config.URL_PREFIX}/users/${encodeURIComponent(
            tasting.createdBy.username,
          )}`,
          icon_url: tasting.createdBy.pictureUrl
            ? absoluteUri(tasting.createdBy.pictureUrl, config.API_SERVER)
            : null,
        },
        title: tasting.bottle.fullName,
        url: `${config.URL_PREFIX}/tastings/${tasting.id}`,
        description: tasting.notes || null,
        fields,
        image: tasting.imageUrl
          ? {
              url: absoluteUri(tasting.imageUrl, config.API_SERVER),
            }
          : null,
      },
    ],
  };

  const body = JSON.stringify(payload);

  const response = await fetch(config.DISCORD_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  if (response.status >= 400) {
    const data = await response.json();
    logError(
      `Error sending Discord webhook: ${response.status}`,
      {
        discord: {
          statusCode: response.status,
          data,
        },
      },
      {
        "payload.json": body,
      },
    );
    console.error({ error: data });
  }
}
