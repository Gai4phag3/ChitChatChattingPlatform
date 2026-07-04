const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * When a message is written, push a notification to the recipient's devices.
 * Works even when the recipient's app is fully closed (via FCM web push).
 */
exports.notifyOnMessage = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const msg = snap.data() || {};
    const sender = msg.sender;
    if (!sender) return null;

    const chatId = context.params.chatId;

    // Prefer the explicit participants list written by the client.
    let recipient = null;
    const chatSnap = await db.collection("chats").doc(chatId).get();
    const participants = (chatSnap.exists && chatSnap.get("participants")) || [];
    recipient = participants.find((u) => u !== sender) || null;

    // Fallback for legacy chats without participants (best-effort).
    if (!recipient) {
      const parts = chatId.split("_");
      recipient = parts.find((u) => u !== sender) || null;
    }
    if (!recipient) return null;

    const tokensSnap = await db
      .collection("fcmTokens")
      .where("user", "==", recipient)
      .get();
    if (tokensSnap.empty) return null;

    const tokens = tokensSnap.docs.map((d) => d.id);

    const isImage = typeof msg.text === "string" && msg.text.startsWith("data:image/");
    const body = isImage ? "📷 Sent a photo" : (msg.text || "New message");

    // Data-only payload: the service worker renders it (prevents duplicates).
    const message = {
      tokens,
      data: {
        title: sender + " on ChitChat",
        body: String(body).slice(0, 240),
        sender: String(sender),
        url: "/dashboard.html"
      },
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: "https://chitchat-254bc.web.app/dashboard.html" }
      }
    };

    const resp = await admin.messaging().sendEachForMulticast(message);

    // Prune tokens that are no longer valid.
    const deletions = [];
    resp.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
      ) {
        deletions.push(db.collection("fcmTokens").doc(tokens[i]).delete());
      }
    });
    if (deletions.length) await Promise.all(deletions);

    return null;
  });
