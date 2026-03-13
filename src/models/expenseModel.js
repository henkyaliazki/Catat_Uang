const pool = require('../db');

const VALID_CATEGORIES = [
  'Makanan & Minuman',
  'Transportasi',
  'Belanja & Kebutuhan Rumah',
  'Kesehatan',
  'Tagihan & Utilitas',
  'Hiburan & Lifestyle',
  'Pendidikan & Pekerjaan',
  'Lainnya',
];

/**
 * Insert one or more expense items for a user.
 * @param {number} userId
 * @param {Array<{nama, jumlah, kategori, tanggal?, sumber?, raw_input?, image_url?}>} items
 * @returns {Promise<Array>} saved rows
 */
async function saveExpenses(userId, items) {
  const saved = [];

  for (const item of items) {
    const result = await pool.query(
      `INSERT INTO expenses (user_id, category_id, nama, jumlah, sumber, tanggal, raw_input, image_url)
       VALUES (
         $1,
         (SELECT id FROM categories WHERE nama = $2 LIMIT 1),
         $3, $4, $5, $6, $7, $8
       )
       RETURNING id, user_id, category_id, nama, jumlah, sumber, tanggal, created_at`,
      [
        userId,
        VALID_CATEGORIES.includes(item.kategori) ? item.kategori : 'Lainnya',
        item.nama,
        item.jumlah,
        item.sumber || 'teks',
        item.tanggal || new Date().toISOString(),
        item.raw_input || null,
        item.image_url || null,
      ],
    );
    saved.push(result.rows[0]);
  }

  return saved;
}

/**
 * Get paginated expenses for a user with optional filters.
 * @param {number} userId
 * @param {{bulan?: number, tahun?: number, limit?: number, offset?: number, kategori?: string, min_jumlah?: number, max_jumlah?: number}} filters
 * @returns {Promise<{rows: Array, count: number}>}
 */
async function getExpenses(userId, { bulan, tahun, limit = 50, offset = 0, kategori, min_jumlah, max_jumlah } = {}) {
  const conditions = ['e.user_id = $1'];
  const params = [userId];
  let idx = 2;

  if (bulan && tahun) {
    conditions.push(`EXTRACT(MONTH FROM e.tanggal) = $${idx}`);
    params.push(bulan);
    idx++;
    conditions.push(`EXTRACT(YEAR FROM e.tanggal) = $${idx}`);
    params.push(tahun);
    idx++;
  } else if (tahun) {
    conditions.push(`EXTRACT(YEAR FROM e.tanggal) = $${idx}`);
    params.push(tahun);
    idx++;
  }

  // Filter based on Kategori (array of strings or comma-separated string)
  if (kategori) {
    const catArray = typeof kategori === 'string' ? kategori.split(',') : kategori;
    if (catArray.length > 0) {
      // Need a subquery or join condition. 
      // e.category_id IN (SELECT id FROM categories WHERE nama = ANY($X))
      conditions.push(`c.nama = ANY($${idx})`);
      params.push(catArray);
      idx++;
    }
  }

  if (min_jumlah !== undefined && min_jumlah !== null && min_jumlah !== '') {
    conditions.push(`e.jumlah >= $${idx}`);
    params.push(Number(min_jumlah));
    idx++;
  }

  if (max_jumlah !== undefined && max_jumlah !== null && max_jumlah !== '') {
    conditions.push(`e.jumlah <= $${idx}`);
    params.push(Number(max_jumlah));
    idx++;
  }

  const where = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(e.id)::int AS total 
     FROM expenses e 
     LEFT JOIN categories c ON c.id = e.category_id 
     WHERE ${where}`,
    params,
  );

  const dataResult = await pool.query(
    `SELECT e.id, e.nama, e.jumlah, c.nama AS kategori, c.icon, e.sumber,
            e.tanggal, e.created_at
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE ${where}
     ORDER BY e.tanggal DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  return { rows: dataResult.rows, count: countResult.rows[0].total };
}

/**
 * Get monthly recap grouped by category.
 * @param {number} userId
 * @param {number} bulan - 1-12
 * @param {number} tahun - e.g. 2026
 * @returns {Promise<Array<{kategori, icon, total, count}>>}
 */
async function getMonthlyRecap(userId, bulan, tahun) {
  const result = await pool.query(
    `SELECT c.nama AS kategori, c.icon, c.color,
            COUNT(e.id)::int AS count,
            COALESCE(SUM(e.jumlah), 0)::bigint AS total
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = $1
       AND EXTRACT(MONTH FROM e.tanggal) = $2
       AND EXTRACT(YEAR FROM e.tanggal) = $3
     GROUP BY c.nama, c.icon, c.color
     ORDER BY total DESC`,
    [userId, bulan, tahun],
  );

  return result.rows;
}

/**
 * Delete an expense with ownership check.
 * @param {number} expenseId
 * @param {number} userId
 * @returns {Promise<{deleted: boolean}>}
 */
async function deleteExpense(expenseId, userId) {
  const result = await pool.query(
    'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
    [expenseId, userId],
  );

  return { deleted: result.rowCount > 0 };
}

/**
 * Cleanup: null-out raw_input for records older than 30 days.
 */
async function cleanRawInput() {
  const result = await pool.query(
    `UPDATE expenses
     SET raw_input = NULL, raw_input_deleted_at = NOW()
     WHERE raw_input IS NOT NULL AND created_at < NOW() - INTERVAL '30 days'`,
  );
  console.log(`[INFO] ${new Date().toISOString()} cleanRawInput: ${result.rowCount} rows cleaned`);
  return result.rowCount;
}

/**
 * Cleanup: null-out image_url for records older than 7 days.
 */
async function cleanImages() {
  const result = await pool.query(
    `UPDATE expenses
     SET image_url = NULL, image_deleted_at = NOW()
     WHERE image_url IS NOT NULL AND created_at < NOW() - INTERVAL '7 days'`,
  );
  console.log(`[INFO] ${new Date().toISOString()} cleanImages: ${result.rowCount} rows cleaned`);
  return result.rowCount;
}

module.exports = {
  VALID_CATEGORIES,
  saveExpenses,
  getExpenses,
  getMonthlyRecap,
  deleteExpense,
  cleanRawInput,
  cleanImages,
};
