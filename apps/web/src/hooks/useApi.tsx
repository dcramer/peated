import { ApiClient } from "@peated/server/lib/apiClient";
import config from "@peated/web/config";
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
