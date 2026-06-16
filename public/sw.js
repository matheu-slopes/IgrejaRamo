/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Ramo da Vida", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Ramo da Vida";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data: { url: data.url || "/dashboard" },
    tag: data.tag || "ramo-notif",
    renotify: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          if ("navigate" in client) {
            return client.navigate(targetUrl).then((navigatedClient) => {
              if (navigatedClient && "focus" in navigatedClient) return navigatedClient.focus();
              return client.focus();
            });
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
