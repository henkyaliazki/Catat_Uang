const axios = require('axios');

const WA_API_URL = `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const WA_TOKEN = process.env.WA_ACCESS_TOKEN;

/**
 * Send a text message via WhatsApp Cloud API.
 * @param {string} toNumber - Recipient WA number (e.g. "6281234567890")
 * @param {string} text - Message body
 */
async function sendMessage(toNumber, text) {
  try {
    await axios.post(
      WA_API_URL,
      {
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const preview = text.substring(0, 20).replace(/\n/g, ' ');
    console.log(`[WA_SEND] ${toNumber} ${preview}`);
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} sendMessage: ${err.message}`);
    throw err;
  }
}

module.exports = { sendMessage };
