import classNames from "@peated/web/lib/classNames";
import { useState, type ReactNode } from "react";
import Button from "./button";

export default ({
  children,
  mobileOnly = false,
}: {
  children: ReactNode;
  mobileOnly?: boolean;
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={classNames(
        mobileOnly ? "sm:max-h-none" : "",
        visible ? "" : "relative max-h-48",
      )}
    >
      <div
        className={classNames(
          mobileOnly ? "sm:max-h-none sm:overflow-auto" : "",
          visible ? "" : "max-h-48 overflow-hidden",
        )}
      >
        {children}
      </div>
      {!visible && (
        <div
          className={classNames(
            mobileOnly ? "sm:hidden" : "",
            "gradient-top-opaque absolute bottom-0 left-0 right-0 flex items-center justify-center p-4",
          )}
        >
          <Button color="primary" onClick={() => setVisible(true)}>
            Show More
          </Button>
        </div>
      )}
    </div>
  );
};
