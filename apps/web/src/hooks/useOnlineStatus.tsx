import type { ReactNode } from "react";
import React, { useContext, useEffect, useState } from "react";

const OnlineStatusContext = React.createContext(true);

export const OnlineStatusProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [onlineStatus, setOnlineStatus] = useState<boolean>(
    globalThis.navigator?.onLine ?? true,
  );

  useEffect(() => {
    window.addEventListener("offline", () => {
      setOnlineStatus(false);
    });
    window.addEventListener("online", () => {
      setOnlineStatus(true);
    });

    return () => {
      window.removeEventListener("offline", () => {
        setOnlineStatus(false);
      });
      window.removeEventListener("online", () => {
        setOnlineStatus(true);
      });
    };
  }, []);

  return (
    <OnlineStatusContext.Provider value={onlineStatus}>
      {children}
    </OnlineStatusContext.Provider>
  );
};

export const useOnlineStatus = () => {
  const store = useContext(OnlineStatusContext);
  return store;
};
