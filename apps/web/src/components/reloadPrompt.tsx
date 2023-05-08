import { pwaInfo } from "virtual:pwa-info";
import { useRegisterSW } from "virtual:pwa-register/react";

import Button from "./button";

export default () => {
  // replaced dynamically
  const buildDate = "__DATE__";
  // replaced dyanmicaly
  const reloadSW = "__RELOAD_SW__";

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // eslint-disable-next-line no-console
      console.log(`Service Worker at: ${swUrl}`);
      // @ts-expect-error just ignore
      if (reloadSW === "true") {
        r &&
          setInterval(() => {
            // eslint-disable-next-line no-console
            console.log("Checking for sw update");
            r.update();
          }, 20000 /* 20s for testing purposes */);
      } else {
        // eslint-disable-next-line prefer-template,no-console
        console.log("SW Registered: " + r);
      }
    },
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.log("SW registration error", error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="w-0 h-0 p-0 m-0">
      {(offlineReady || needRefresh) && (
        <div className="fixed right-0 bottom-0 m-4 p-3 border border-gray-400 rounded z-10 shadow bg-white">
          <div className="mb-2">
            {offlineReady ? (
              <span>App ready to work offline</span>
            ) : (
              <span>
                New content available, click on reload button to update.
              </span>
            )}
          </div>
          {needRefresh && (
            <Button color="primary" onClick={() => updateServiceWorker(true)}>
              Reload
            </Button>
          )}
          <Button onClick={() => close()}>Close</Button>
        </div>
      )}
      <div className="hidden">{buildDate}</div>
    </div>
  );
};
