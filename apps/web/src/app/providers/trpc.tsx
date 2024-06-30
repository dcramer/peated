"use client";

import { sentryLink } from "@peated/server/lib/trpc";
import config from "@peated/web/config";
import { trpc } from "@peated/web/lib/trpc";
import { httpBatchLink } from "@trpc/client";
import type { ComponentProps } from "react";
import { useState } from "react";

export default function TRPCProvider({
  accessToken,
  ...props
}: { accessToken?: string | null } & Omit<
  ComponentProps<typeof trpc.Provider>,
  "client"
>) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        sentryLink(),
        httpBatchLink({
          url: `${config.API_SERVER}/trpc`,
          maxBatchSize: 10,
          async headers() {
            return {
              authorization: accessToken ? `Bearer ${accessToken}` : "",
            };
          },
        }),
      ],
    }),
  );

  return <trpc.Provider client={trpcClient} {...props} />;
}
