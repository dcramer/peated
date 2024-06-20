import config from "@peated/web-next/config";
import { ApiClient } from "@peated/web-next/lib/api";
import { createContext, useContext } from "react";

const ApiContext = createContext<ApiClient>(
  new ApiClient({ server: config.API_SERVER }),
);

export const ApiProvider = ({
  server,
  accessToken,
  children,
}: {
  server: string;
  accessToken?: string | null;
  children: any;
}) => {
  return (
    <ApiContext.Provider value={new ApiClient({ server, accessToken })}>
      {children}
    </ApiContext.Provider>
  );
};

export default function useApi() {
  return useContext(ApiContext);
}
