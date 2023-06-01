import { createContext, useContext } from "react";
import config from "~/config";
import { ApiClient } from "~/lib/api";

const ApiContext = createContext<ApiClient>(new ApiClient(config.API_SERVER));

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
