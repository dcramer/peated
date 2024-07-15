"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useInterval } from "usehooks-ts";
import classNames from "../lib/classNames";

const ALIVE_TIME = 8000; // 8 seconds

let messageNum = 0;

type FlashType = "success" | "error";

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

function Message({ message, type }: Pick<FlashMessage, "message" | "type">) {
  return (
    <div
      className={classNames(
        "rounded-md bg-green-700 p-3 font-semibold text-green-50 opacity-90",
        type === "success" ? "bg-green-700 text-green-50" : "",
        type === "error" ? "bg-red-700 text-red-50" : "",
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
      <div className="fixed right-0 top-0 z-50 flex max-w-xl flex-col gap-y-4 p-4">
        {messages.map((m) => (
          <Message {...m} key={m.id} />
        ))}
      </div>
      {children}
    </FlashContext.Provider>
  );
}
