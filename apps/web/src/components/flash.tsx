"use client";

import { type ReactNode, createContext, useContext, useState } from "react";
import { useInterval } from "usehooks-ts";
import classNames from "../lib/classNames";

const ALIVE_TIME = 8000; // 8 seconds

let messageNum = 0;

type FlashType = "success" | "error" | "info";

type FlashMessage = {
  id: number;
  message: string | ReactNode;
  type: FlashType;
  createdAt: number;
};

const FlashContext = createContext<{
  flash: (message: string | ReactNode, type?: FlashType) => void;
}>({
  flash: () => {
    throw new Error("FlashContext not initialized");
  },
});

export function useFlashMessages() {
  return useContext(FlashContext);
}

export function Message({
  message,
  type,
}: Pick<FlashMessage, "message" | "type">) {
  return (
    <div
      className={classNames(
        "rounded-md p-3 font-semibold opacity-90",
        type === "success" ? "bg-green-700 text-green-50" : "",
        type === "error" ? "bg-red-700 text-red-50" : "",
        type === "info" ? "bg-slate-700 text-slate-50" : ""
      )}
    >
      {message}
    </div>
  );
}

export default function FlashMessages({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FlashMessage[]>([]);

  useInterval(() => {
    setMessages((messages) => {
      const cutoff = new Date().getTime() - ALIVE_TIME;
      return messages.filter((m) => m.createdAt > cutoff);
    });
  }, 1000);

  return (
    <FlashContext.Provider
      value={{
        flash: (message: string | ReactNode, type: FlashType = "success") => {
          setMessages((messages) => {
            const cutoff = new Date().getTime() - ALIVE_TIME;
            return [
              ...messages.filter((m) => m.createdAt > cutoff),
              {
                message,
                type,
                id: messageNum,
                createdAt: new Date().getTime(),
              },
            ];
          });
          messageNum += 1;
        },
      }}
    >
      <div className="fixed top-0 right-0 z-50 flex max-w-xl flex-col gap-y-4 p-4">
        {messages.map((m) => (
          <Message {...m} key={m.id} />
        ))}
      </div>
      {children}
    </FlashContext.Provider>
  );
}
