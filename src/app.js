require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());

// ── Health Check ────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'CatatUang API',
      version: '1.0.0',
      status: 'running',
    },
    error: null,
  });
});

// ── Routes ──────────────────────────────────────────────────
const webhookRouter = require('./routes/webhook');
const expensesRouter = require('./routes/expenses');
app.use('/webhook', webhookRouter);
app.use('/api/v1/expenses', expensesRouter);

// ── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[INFO] ${new Date().toISOString()} CatatUang API running on port ${PORT}`);
});

module.exports = app;
