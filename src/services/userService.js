const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '90d';

/**
 * Generate a signed JWT for a given user.
 */
function generateToken(userId, waNumber) {
  return jwt.sign({ userId, waNumber }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Find an existing user by WA number or create a new one.
 * If the user exists but has no token, a new JWT is generated.
 * @param {string} waNumber
 * @returns {Promise<{user: object, token: string, isNew: boolean}>}
 */
async function findOrCreateUser(waNumber) {
  try {
    // Check if user already exists
    const existing = await pool.query(
      'SELECT id, wa_number, nama, jwt_token FROM users WHERE wa_number = $1',
      [waNumber],
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      let token = user.jwt_token;

      // Generate a new token if missing
      if (!token) {
        token = generateToken(user.id, user.wa_number);
        await pool.query('UPDATE users SET jwt_token = $1 WHERE id = $2', [token, user.id]);
      }

      return {
        user: { id: user.id, wa_number: user.wa_number, nama: user.nama },
        token,
        isNew: false,
      };
    }

    // Create new user
    const token = generateToken(0, waNumber); // temporary id
    const result = await pool.query(
      'INSERT INTO users (wa_number, jwt_token) VALUES ($1, $2) RETURNING id, wa_number, nama',
      [waNumber, null],
    );

    const newUser = result.rows[0];

    // Re-generate token with the real user id
    const finalToken = generateToken(newUser.id, newUser.wa_number);
    await pool.query('UPDATE users SET jwt_token = $1 WHERE id = $2', [finalToken, newUser.id]);

    return {
      user: { id: newUser.id, wa_number: newUser.wa_number, nama: newUser.nama },
      token: finalToken,
      isNew: true,
    };
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} findOrCreateUser: ${err.message}`);
    throw err;
  }
}

/**
 * Generate a fresh JWT for an existing user and persist it.
 * @param {string} waNumber
 * @returns {Promise<{token: string}>}
 */
async function refreshToken(waNumber) {
  try {
    const result = await pool.query(
      'SELECT id, wa_number FROM users WHERE wa_number = $1',
      [waNumber],
    );

    if (result.rows.length === 0) {
      throw new Error('USER_NOT_FOUND');
    }

    const user = result.rows[0];
    const token = generateToken(user.id, user.wa_number);

    await pool.query('UPDATE users SET jwt_token = $1 WHERE id = $2', [token, user.id]);

    return { token };
  } catch (err) {
    console.error(`[ERROR] ${new Date().toISOString()} refreshToken: ${err.message}`);
    throw err;
  }
}

module.exports = { findOrCreateUser, refreshToken };
