require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());

// ── CORS (dev: allow localhost:5173) ────────────────────────
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:5173'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WA-Number');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

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

// ── Dev Mode Tools ──────────────────────────────────────────
// Temporary endpoint to login to dashboard without WhatsApp
app.get('/api/v1/dev/login', async (req, res) => {
  try {
    const waNumber = req.query.wa || '628123456789';
    const { findOrCreateUser } = require('./services/userService');
    const result = await findOrCreateUser(waNumber);
    // Return token as JSON — frontend akan handle redirect
    return res.json({ success: true, data: { token: result.token }, error: null });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} dev/login: ${error.message}`);
    return res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// ── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[INFO] ${new Date().toISOString()} CatatUang API running on port ${PORT}`);
});

module.exports = app;
