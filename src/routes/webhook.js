const express = require('express');
const axios = require('axios');
const { handleIncomingMessage } = require('../services/botHandler');

const router = express.Router();

// ── In-memory rate limiter per WA number (30 req/min) ────────
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function isRateLimited(waNumber) {
  const now = Date.now();
  const entry = rateLimitMap.get(waNumber);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(waNumber, { windowStart: now, count: 1 });
    return false;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// ── GET /webhook — Meta verification ────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log(`[INFO] ${new Date().toISOString()} Webhook verified`);
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, data: null, error: 'Forbidden' });
});

// ── POST /webhook — Incoming messages ───────────────────────
router.post('/', async (req, res) => {
  // Always return 200 to Meta immediately
  res.status(200).json({ success: true, data: null, error: null });

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return; // Not a message event (e.g. status update)

    const waNumber = message.from;

    // Rate limit check
    if (isRateLimited(waNumber)) {
      const { sendMessage } = require('../services/whatsappService');
      await sendMessage(waNumber, '⏳ Terlalu banyak pesan. Tunggu sebentar ya.');
      return;
    }

    // ── Text message ──────────────────────────────────────
    if (message.type === 'text' && message.text?.body) {
      await handleIncomingMessage(waNumber, 'text', message.text.body);
      return;
    }

    // ── Image message ─────────────────────────────────────
    if (message.type === 'image' && message.image?.id) {
      const imageId = message.image.id;
      const mimeType = message.image.mime_type || 'image/jpeg';

      // Step 1: Get image download URL from Meta
      const metaRes = await axios.get(
        `https://graph.facebook.com/v18.0/${imageId}`,
        { headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` } },
      );
      const imageUrl = metaRes.data.url;

      // Step 2: Download image as buffer
      const imgRes = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` },
      });

      const base64 = Buffer.from(imgRes.data).toString('base64');

      await handleIncomingMessage(waNumber, 'image', { base64, mimeType });
      return;
    }
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} webhook POST: ${err.message}`);
  }
});

module.exports = router;
