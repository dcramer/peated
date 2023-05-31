/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

declare global {
  interface Window {
    CONFIG: Record<string, any>;
  }
}
