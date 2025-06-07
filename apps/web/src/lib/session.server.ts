import type { User } from "@peated/server/types";

if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not defined.");
}

export interface SessionData {
  user: User | null;
  accessToken: string | null;
  ts: number | null;
}

export const defaultSession: SessionData = {
  user: null,
  accessToken: null,
  ts: null,
};

// Client-side session management
const SESSION_KEY = "peated_session";

export function useAppSession() {
  return {
    data: getSessionData(),
    update: setSessionData,
    clear: clearSessionData,
  };
}

function getSessionData(): SessionData {
  if (typeof window === "undefined") return defaultSession;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : defaultSession;
  } catch {
    return defaultSession;
  }
}

function setSessionData(session: SessionData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSessionData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}
