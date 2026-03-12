const pool = require('../db');
const { parseTextExpense, parseImageExpense } = require('./geminiService');
const { findOrCreateUser } = require('./userService');
const { sendMessage } = require('./whatsappService');

const REKAP_KEYWORDS = ['rekap', 'ringkasan', 'laporan', 'summary', '/rekap'];

// ── Helpers ─────────────────────────────────────────────────

/**
 * Format number as Indonesian Rupiah (e.g. 25000 → "25.000").
 */
function formatRupiah(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format a single expense item as a confirmation line.
 */
function formatConfirmation(item) {
  const tgl = item.tanggal
    ? new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return `📝 ${item.nama}\n💰 Rp ${formatRupiah(item.jumlah)}\n🏷️ ${item.kategori}\n📅 ${tgl}`;
}

/**
 * Save an expense item to the database.
 */
async function saveExpense(userId, item, sumber, rawInput, imageUrl) {
  const result = await pool.query(
    `INSERT INTO expenses (user_id, category_id, nama, jumlah, sumber, tanggal, raw_input, image_url)
     VALUES ($1,
       (SELECT id FROM categories WHERE nama = $2 LIMIT 1),
       $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      item.kategori,
      item.nama,
      item.jumlah,
      sumber,
      item.tanggal || new Date().toISOString(),
      rawInput || null,
      imageUrl || null,
    ],
  );
  return result.rows[0];
}

/**
 * Get monthly recap for a user (current month).
 */
async function getMonthlyRecap(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const result = await pool.query(
    `SELECT c.nama AS kategori, c.icon, COUNT(e.id)::int AS count, COALESCE(SUM(e.jumlah), 0)::bigint AS total
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = $1 AND e.tanggal BETWEEN $2 AND $3
     GROUP BY c.nama, c.icon
     ORDER BY total DESC`,
    [userId, startOfMonth, endOfMonth],
  );

  return result.rows;
}

// ── Main Handler ────────────────────────────────────────────

/**
 * Handle an incoming WhatsApp message.
 * @param {string} waNumber - Sender's WA number
 * @param {"text"|"image"} messageType
 * @param {string|{base64: string, mimeType: string}} content
 */
async function handleIncomingMessage(waNumber, messageType, content) {
  try {
    // Always find or create the user first
    const { user } = await findOrCreateUser(waNumber);

    // ── TEXT ───────────────────────────────────────────────
    if (messageType === 'text') {
      const text = content.trim();
      const lower = text.toLowerCase();

      // Check for recap command
      if (REKAP_KEYWORDS.some((kw) => lower.includes(kw))) {
        const rows = await getMonthlyRecap(user.id);
        const now = new Date();
        const bulan = now.toLocaleDateString('id-ID', { month: 'long' });
        const tahun = now.getFullYear();

        if (rows.length === 0) {
          await sendMessage(waNumber, `📊 Rekap ${bulan} ${tahun}\n\nBelum ada pengeluaran tercatat bulan ini.`);
          return;
        }

        const grandTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);
        let msg = `📊 Rekap ${bulan} ${tahun}\n💰 Total: Rp ${formatRupiah(grandTotal)}\n\n`;
        for (const r of rows) {
          msg += `${r.icon} ${r.kategori}: Rp ${formatRupiah(Number(r.total))} (${r.count} transaksi)\n`;
        }

        await sendMessage(waNumber, msg.trim());
        return;
      }

      // Parse as expense
      const parsed = await parseTextExpense(text);

      if (!parsed.is_expense || parsed.items.length === 0) {
        await sendMessage(
          waNumber,
          '🤖 Hai! Saya tidak mendeteksi pengeluaran dari pesanmu.\n\n'
          + 'Coba kirim seperti:\n'
          + '• "Makan siang nasi padang 25rb"\n'
          + '• "Grab ke kantor 15k"\n'
          + '• Kirim foto struk/nota\n'
          + '• Ketik "rekap" untuk ringkasan bulanan',
        );
        return;
      }

      // Save each item
      for (const item of parsed.items) {
        await saveExpense(user.id, item, 'teks', text, null);
      }

      // Send confirmation
      if (parsed.items.length === 1) {
        const item = parsed.items[0];
        await sendMessage(waNumber, `✅ Tercatat!\n\n${formatConfirmation(item)}`);
      } else {
        let msg = `✅ ${parsed.items.length} pengeluaran tercatat!\n`;
        let total = 0;
        for (const item of parsed.items) {
          msg += `\n${formatConfirmation(item)}\n`;
          total += item.jumlah;
        }
        msg += `\n💰 Total: Rp ${formatRupiah(total)}`;
        await sendMessage(waNumber, msg);
      }

      return;
    }

    // ── IMAGE ─────────────────────────────────────────────
    if (messageType === 'image') {
      const { base64, mimeType } = content;
      const parsed = await parseImageExpense(base64, mimeType);

      if (parsed.error) {
        if (parsed.error === 'Foto tidak terbaca' || parsed.error === 'FILE_TOO_LARGE') {
          await sendMessage(
            waNumber,
            '📷 Maaf, foto tidak terbaca. Coba kirim ulang dengan pencahayaan yang lebih baik dan pastikan teks terlihat jelas.',
          );
        } else {
          await sendMessage(waNumber, '⚠️ Terjadi kesalahan saat memproses foto. Silakan coba lagi.');
        }
        return;
      }

      if (!parsed.is_expense || parsed.items.length === 0) {
        await sendMessage(
          waNumber,
          '📷 Saya tidak menemukan item pengeluaran di foto ini. Pastikan foto berisi struk/nota belanja.',
        );
        return;
      }

      // Save each item
      for (const item of parsed.items) {
        await saveExpense(user.id, item, 'foto', null, null);
      }

      // Send confirmation
      if (parsed.items.length === 1) {
        const item = parsed.items[0];
        await sendMessage(waNumber, `✅ Tercatat dari foto!\n\n${formatConfirmation(item)}`);
      } else {
        let msg = `✅ ${parsed.items.length} pengeluaran tercatat dari foto!\n`;
        let total = 0;
        for (const item of parsed.items) {
          msg += `\n${formatConfirmation(item)}\n`;
          total += item.jumlah;
        }
        msg += `\n💰 Total: Rp ${formatRupiah(total)}`;
        await sendMessage(waNumber, msg);
      }

      return;
    }
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} handleIncomingMessage: ${err.message}`);
    try {
      await sendMessage(waNumber, '⚠️ Maaf, terjadi kesalahan. Silakan coba lagi nanti.');
    } catch (_) {
      // Suppress send error to avoid infinite loop
    }
  }
}

module.exports = { handleIncomingMessage };
