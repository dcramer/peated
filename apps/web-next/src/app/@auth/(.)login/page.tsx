"use client";

import Login from "@peated/web/ui/login";

export default function Page() {
  return (
    <div className="dialog">
      <div className="fixed inset-0" />
      <div className="dialog-panel flex flex-col items-center justify-center px-4 pb-4 pt-5 sm:p-6">
        <Login />
      </div>
    </div>
  );
}
