/* Registers this device for Firebase Cloud Messaging so the logged-in user
   receives push notifications for new messages even when the app is closed.
   Included on dashboard.html and chat.html (after firebase-config.js). */
(function () {
  // ⚠️ REQUIRED: paste your Web Push certificate key pair here.
  // Firebase console → Project settings → Cloud Messaging →
  //   "Web configuration" → Web Push certificates → copy the "Key pair".
  var VAPID_KEY = "PASTE_YOUR_WEB_PUSH_CERTIFICATE_KEY_HERE";

  var user = localStorage.getItem("username");
  if (!user) return;

  if (typeof firebase === "undefined" || !firebase.messaging) return;
  try {
    if (!firebase.messaging.isSupported || !firebase.messaging.isSupported()) return;
  } catch (e) { return; }

  if (VAPID_KEY.indexOf("PASTE_") === 0) {
    console.warn("[push] Closed-app push is off: set VAPID_KEY in push.js.");
    return;
  }
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

  function registerToken() {
    navigator.serviceWorker.register("/firebase-messaging-sw.js")
      .then(function (reg) {
        var messaging = firebase.messaging();
        return messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      })
      .then(function (token) {
        if (!token) return;
        // Keyed by token so re-registering the same device is idempotent.
        return db.collection("fcmTokens").doc(token).set({
          user: user,
          updatedAt: Date.now()
        });
      })
      .catch(function (err) {
        console.warn("[push] Could not register for push:", err);
      });
  }

  if (Notification.permission === "granted") {
    registerToken();
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then(function (p) {
      if (p === "granted") registerToken();
    });
  }
})();
