import { getLinks } from "@peated/server/trpc/links";
import { getQueryClient } from "@peated/server/trpc/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ComponentProps, useState } from "react";
import { trpc } from "./client";

export default function TRPCProvider({
  accessToken,
  apiServer,
  ...props
}: { accessToken?: string | null; apiServer: string } & Omit<
  ComponentProps<typeof trpc.Provider>,
  "client" | "queryClient"
>) {
  const queryClient = getQueryClient(false);

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: getLinks({
        apiServer,
        accessToken,
        batch: true,
      }),
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
