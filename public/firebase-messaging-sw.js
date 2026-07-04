/* Firebase Cloud Messaging service worker.
   Handles push messages when the app is backgrounded OR fully closed.
   Must live at the site root so FCM can find it. Config is inlined because a
   service worker has no `window` (so firebase-config.js can't be reused here). */

importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js");

firebase.initializeApp({
  apiKey: "AIzaSyCx00DmHMLmiDbfFUiBN3w5ueIxAzLqWus",
  authDomain: "chitchat-254bc.firebaseapp.com",
  projectId: "chitchat-254bc",
  storageBucket: "chitchat-254bc.appspot.com",
  messagingSenderId: "7406729436",
  appId: "1:7406729436:web:4ceec3453f658398215c19"
});

const messaging = firebase.messaging();

// The Cloud Function sends data-only messages so we control rendering here
// (avoids the browser auto-showing a duplicate notification).
messaging.setBackgroundMessageHandler(function (payload) {
  const d = (payload && payload.data) || {};
  const title = d.title || "ChitChat";
  const options = {
    body: d.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: d.sender ? "chitchat-" + d.sender : "chitchat-msg",
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: d.url || "/dashboard.html" }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
