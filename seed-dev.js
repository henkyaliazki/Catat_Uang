require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const userRes = await pool.query("SELECT id FROM users WHERE wa_number = '628123456789'");
  if (userRes.rows.length === 0) {
    console.error('User dummy belum ada! Klik tombol Dev Login dulu agar user terbuat.');
    return;
  }
  const userId = userRes.rows[0].id;
  console.log('User ID:', userId);

  const expenses = [
    { nama: 'Makan Siang Warteg', jumlah: 20000, kat: 'Makanan & Minuman', hari: 1 },
    { nama: 'Kopi Kenangan', jumlah: 35000, kat: 'Makanan & Minuman', hari: 3 },
    { nama: 'Grab ke kantor', jumlah: 25000, kat: 'Transportasi', hari: 5 },
    { nama: 'Baju di Shopee', jumlah: 150000, kat: 'Belanja & Kebutuhan', hari: 7 },
    { nama: 'Token Listrik', jumlah: 100000, kat: 'Tagihan & Utilitas', hari: 10 },
    { nama: 'Netflix', jumlah: 54000, kat: 'Hiburan & Lifestyle', hari: 12 },
    { nama: 'Vitamin C', jumlah: 45000, kat: 'Kesehatan', hari: 15 },
    { nama: 'Kursus Online Udemy', jumlah: 70000, kat: 'Pendidikan & Pekerjaan', hari: 18 },
    { nama: 'Bensin Motor', jumlah: 60000, kat: 'Transportasi', hari: 20 },
    { nama: 'Dinner Sekeluarga', jumlah: 250000, kat: 'Makanan & Minuman', hari: 22 },
    { nama: 'Air Mineral Galon', jumlah: 22000, kat: 'Belanja & Kebutuhan', hari: 24 },
    { nama: 'Internet Indihome', jumlah: 275000, kat: 'Tagihan & Utilitas', hari: 25 },
  ];

  for (const e of expenses) {
    const tgl = new Date(2026, 2, e.hari); // Maret 2026
    await pool.query(
      `INSERT INTO expenses (user_id, category_id, nama, jumlah, sumber, tanggal)
       VALUES ($1, (SELECT id FROM categories WHERE nama = $2 LIMIT 1), $3, $4, 'dev_seed', $5)`,
      [userId, e.kat, e.nama, e.jumlah, tgl.toISOString()]
    );
    console.log('  + inserted:', e.nama);
  }
  console.log('');
  console.log('Berhasil! ' + expenses.length + ' data dummy dimasukkan.');
  console.log('Refresh dashboard di http://localhost:5173');
  await pool.end();
}

seed().catch(async (e) => {
  console.error('ERROR:', e.message);
  await pool.end();
});
