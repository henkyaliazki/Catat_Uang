const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error(`[ERROR] ${new Date().toISOString()} Unexpected DB pool error: ${err.message}`);
});

module.exports = pool;
