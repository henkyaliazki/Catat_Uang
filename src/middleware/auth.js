const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Express middleware — verify Bearer JWT and populate req.user.
 * Also reads X-WA-Number header as an optional identifier.
 */
function authenticateJWT(req, res, next) {
  // Read optional WA number identifier
  req.waNumber = req.headers['x-wa-number'] || null;

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Unauthorized',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, waNumber: decoded.waNumber };
    next();
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} authenticateJWT: ${err.message}`);
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Unauthorized',
    });
  }
}

module.exports = { authenticateJWT };
