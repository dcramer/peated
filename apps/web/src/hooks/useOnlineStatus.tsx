import type { ReactNode } from "react";
import React, { useContext, useSyncExternalStore } from "react";

const OnlineStatusContext = React.createContext(true);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("offline", onStoreChange);
  window.addEventListener("online", onStoreChange);

  return () => {
    window.removeEventListener("offline", onStoreChange);
    window.removeEventListener("online", onStoreChange);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function getServerOnlineStatus() {
  return true;
}

export const OnlineStatusProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const onlineStatus = useSyncExternalStore(
    subscribe,
    getOnlineStatus,
    getServerOnlineStatus,
  );

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
