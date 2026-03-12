const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { refreshToken } = require('../services/userService');
const {
  VALID_CATEGORIES,
  saveExpenses,
  getExpenses,
  getMonthlyRecap,
  deleteExpense,
} = require('../models/expenseModel');

const router = express.Router();

// ── Input Validation Helpers ────────────────────────────────

function sanitizeString(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function validateExpenseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'items harus berupa array dan tidak boleh kosong';
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.nama || typeof item.nama !== 'string' || item.nama.trim().length === 0) {
      return `items[${i}].nama wajib diisi`;
    }

    if (!Number.isInteger(item.jumlah) || item.jumlah <= 0) {
      return `items[${i}].jumlah harus integer > 0`;
    }

    if (!item.kategori || !VALID_CATEGORIES.includes(item.kategori)) {
      return `items[${i}].kategori tidak valid. Pilih: ${VALID_CATEGORIES.join(', ')}`;
    }
  }

  return null;
}

// ── GET /api/v1/expenses ────────────────────────────────────
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const bulan = req.query.bulan ? parseInt(req.query.bulan, 10) : undefined;
    const tahun = req.query.tahun ? parseInt(req.query.tahun, 10) : undefined;
    let limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    // Cap limit at 100
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 50;

    const { rows, count } = await getExpenses(req.user.userId, { bulan, tahun, limit, offset });

    return res.json({ success: true, data: rows, count, error: null });
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} GET /expenses: ${err.message}`);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
});

// ── GET /api/v1/expenses/rekap ──────────────────────────────
router.get('/rekap', authenticateJWT, async (req, res) => {
  try {
    const now = new Date();
    const bulan = req.query.bulan ? parseInt(req.query.bulan, 10) : now.getMonth() + 1;
    const tahun = req.query.tahun ? parseInt(req.query.tahun, 10) : now.getFullYear();

    const rows = await getMonthlyRecap(req.user.userId, bulan, tahun);
    const totalKeseluruhan = rows.reduce((sum, r) => sum + Number(r.total), 0);

    return res.json({
      success: true,
      data: rows,
      total_keseluruhan: totalKeseluruhan,
      bulan,
      tahun,
      error: null,
    });
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} GET /expenses/rekap: ${err.message}`);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
});

// ── POST /api/v1/expenses ───────────────────────────────────
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { items } = req.body || {};

    const validationError = validateExpenseItems(items);
    if (validationError) {
      return res.status(400).json({ success: false, data: null, error: validationError });
    }

    // Sanitize inputs
    const sanitizedItems = items.map((item) => ({
      nama: sanitizeString(item.nama, 100),
      jumlah: item.jumlah,
      kategori: item.kategori,
      tanggal: item.tanggal || null,
      sumber: 'api',
      raw_input: item.catatan ? sanitizeString(item.catatan, 500) : null,
    }));

    const saved = await saveExpenses(req.user.userId, sanitizedItems);

    return res.status(201).json({ success: true, data: saved, error: null });
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} POST /expenses: ${err.message}`);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
});

// ── DELETE /api/v1/expenses/:id ─────────────────────────────
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const expenseId = parseInt(req.params.id, 10);

    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      return res.status(400).json({ success: false, data: null, error: 'ID tidak valid' });
    }

    const { deleted } = await deleteExpense(expenseId, req.user.userId);

    if (!deleted) {
      return res.status(404).json({ success: false, data: null, error: 'Expense tidak ditemukan' });
    }

    return res.json({ success: true, data: { deleted_id: expenseId }, error: null });
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} DELETE /expenses/:id: ${err.message}`);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
});

// ── POST /api/v1/auth/refresh ───────────────────────────────
router.post('/auth/refresh', async (req, res) => {
  try {
    const waNumber = req.headers['x-wa-number'];

    if (!waNumber) {
      return res.status(400).json({ success: false, data: null, error: 'X-WA-Number header wajib diisi' });
    }

    const { token } = await refreshToken(waNumber);

    return res.json({ success: true, data: { token }, error: null });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, data: null, error: 'User tidak ditemukan' });
    }
    console.error(`[ERROR] ${new Date().toISOString()} POST /auth/refresh: ${err.message}`);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
});

module.exports = router;
