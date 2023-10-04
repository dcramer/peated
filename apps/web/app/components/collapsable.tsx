import { useState, type ReactNode } from "react";
import Button from "./button";

export default ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={visible ? "" : "relative max-h-48"}>
      <div className={visible ? "" : "max-h-48 overflow-hidden"}>
        {children}
      </div>
      {!visible && (
        <div className="gradient-top-opaque absolute bottom-0 left-0 right-0 flex items-center justify-center p-4">
          <Button color="primary" onClick={() => setVisible(true)}>
            Show More
          </Button>
        </div>
      )}
    </div>
  );
};
