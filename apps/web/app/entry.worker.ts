// entry.worker.ts
/// <reference lib="WebWorker" />

import { PrecacheHandler } from "@remix-pwa/sw";

export type {};
declare let self: ServiceWorkerGlobalScope;

const PAGES = "page-cache";
const DATA = "data-cache";
const ASSETS = "assets-cache";
const STATIC_ASSETS = ["/build/", "/icons/", "/favicon.ico"];

const precacheHandler = new PrecacheHandler({
  dataCacheName: DATA,
  documentCacheName: PAGES,
  assetCacheName: ASSETS,
});

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  event.waitUntil(precacheHandler.handle(event));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request.clone()));
});

// self.addEventListener('install', (event: ExtendableEvent) => {
//   console.log('Service worker installed');
//   event.waitUntil(self.skipWaiting());
// });

// self.addEventListener('activate', (event: ExtendableEvent) => {
//   console.log('Service worker activated');
//   event.waitUntil(self.clients.claim());
// });

// self.addEventListener('message', (event: ExtendableMessageEvent) => {
//   console.log('Service worker received message', event.data);
// });

/******** Push Event ********/
// class PushHandler extends Push {
//   async handlePush(event: PushEvent): Promise<void> {}

//   async handleNotificationClick(event: NotificationEvent): Promise<void> {}

//   async handleNotificationClose(event: NotificationEvent): Promise<void> {}

//   async handleError(error: ErrorEvent): Promise<void> {}
// }

// const pushHandler = new PushHandler();

// self.addEventListener("push", (event: PushEvent) => {
//   pushHandler.handlePush(event);
// });

// self.addEventListener("notificationclick", (event: NotificationEvent) => {
//   pushHandler.handleNotificationClick(event);
// });

// self.addEventListener("notificationclose", (event: NotificationEvent) => {
//   pushHandler.handleNotificationClose(event);
// });

// self.addEventListener("error", (error: ErrorEvent) => {
//   pushHandler.handleError(error);
// });
