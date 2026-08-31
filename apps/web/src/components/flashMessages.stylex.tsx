"use client";

import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useInterval } from "usehooks-ts";

import {
  FlashMessage,
  type FlashMessageTone,
} from "@peated/web/components/feedback.stylex";
import { space } from "../styles/tokens.stylex";

const MESSAGE_LIFETIME = 8000;

let nextMessageId = 0;

type Message = {
  createdAt: number;
  id: number;
  message: ReactNode;
  tone: FlashMessageTone;
};

const FlashContext = createContext<{
  flash: (message: ReactNode, tone?: FlashMessageTone) => void;
}>({
  flash: () => {
    throw new Error("FlashContext not initialized");
  },
});

export function useFlashMessages() {
  return useContext(FlashContext);
}

export function FlashMessages({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useInterval(() => {
    setMessages((current) => {
      const cutoff = Date.now() - MESSAGE_LIFETIME;
      const active = current.filter((message) => message.createdAt > cutoff);
      return active.length === current.length ? current : active;
    });
  }, 1000);

  const flash = useCallback(
    (message: ReactNode, tone: FlashMessageTone = "success") => {
      const now = Date.now();
      setMessages((current) => [
        ...current.filter(
          (activeMessage) => activeMessage.createdAt > now - MESSAGE_LIFETIME,
        ),
        {
          createdAt: now,
          id: nextMessageId,
          message,
          tone,
        },
      ]);
      nextMessageId += 1;
    },
    [],
  );
  const contextValue = useMemo(() => ({ flash }), [flash]);

  return (
    <FlashContext.Provider value={contextValue}>
      <div aria-live="polite" {...stylex.props(styles.messages)}>
        {messages.map(({ id, message, tone }) => (
          <FlashMessage key={id} tone={tone}>
            {message}
          </FlashMessage>
        ))}
      </div>
      {children}
    </FlashContext.Provider>
  );
}

const styles = stylex.create({
  messages: {
    position: "fixed",
    zIndex: 80,
    top: space.x4,
    right: space.x4,
    left: { default: "auto", "@media (max-width: 559px)": space.x4 },
    display: "flex",
    width: {
      default: "min(480px, calc(100vw - 32px))",
      "@media (max-width: 559px)": "auto",
    },
    flexDirection: "column",
    rowGap: space.x2,
    pointerEvents: "none",
  },
});
