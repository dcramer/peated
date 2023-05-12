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
    <div className="m-0 h-0 w-0 p-0">
      {needRefresh && (
        <div className="fixed bottom-0 right-0 z-10 m-4 rounded border border-gray-400 bg-white p-3 shadow">
          <div className="mb-2">
            <span>Update Available</span>
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
