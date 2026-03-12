const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

const PROMPT_TEMPLATE = `Kamu adalah expense parser untuk aplikasi keuangan Indonesia.
Ekstrak pengeluaran dari teks berikut.
Kembalikan HANYA JSON valid, tidak ada teks lain.

Kategori yang tersedia (pilih yang paling sesuai):
"Makanan & Minuman" — kata kunci: makan, minum, kopi, resto, warung, nasi, gorengan, jajan, grab food, gofood
"Transportasi" — kata kunci: bensin, ojek, gojek, grab, busway, KRL, parkir, tol, taxi, motor, BBM
"Belanja & Kebutuhan Rumah" — alfamart, indomaret, supermarket, sabun, deterjen, sembako, beras, minyak
"Kesehatan" — apotek, obat, dokter, klinik, rs, vitamin, masker, BPJS
"Tagihan & Utilitas" — listrik, air, PLN, PDAM, internet, wifi, pulsa, token, cicilan, tagihan
"Hiburan & Lifestyle" — netflix, spotify, bioskop, game, karaoke, spa, gym, baju, sepatu
"Pendidikan & Pekerjaan" — kursus, buku, seminar, pelatihan, domain
"Lainnya" — fallback jika tidak cocok

Singkatan: rb/ribu = ×1000, k = ×1000, jt/juta = ×1000000

Output HARUS dalam format JSON berikut:
{
  "is_expense": boolean,
  "items": [
    {
      "nama": "string (max 100 char)",
      "jumlah": integer (IDR, tanpa desimal),
      "kategori": "string (salah satu dari 8 kategori di atas)",
      "tanggal": "string ISO8601 | null",
      "confidence": float 0.0-1.0
    }
  ],
  "error": null
}

Teks user:
`;

const VISION_PROMPT_TEMPLATE = `Ini adalah foto struk/nota belanja dari Indonesia.
Ekstrak semua item pengeluaran yang tertera.
Jika ada tanggal transaksi, sertakan dalam format ISO8601.
Kembalikan HANYA JSON valid dengan schema berikut:
{
  "is_expense": boolean,
  "items": [
    {
      "nama": "string (max 100 char)",
      "jumlah": integer (IDR, tanpa desimal),
      "kategori": "string (salah satu dari 8 kategori di bawah)",
      "tanggal": "string ISO8601 | null",
      "confidence": float 0.0-1.0
    }
  ],
  "error": null
}
Jika foto tidak terbaca/buram, set error: "Foto tidak terbaca"

Kategori yang tersedia:
"Makanan & Minuman" — makan, minum, kopi, resto, warung, nasi, gorengan, jajan, grab food, gofood
"Transportasi" — bensin, ojek, gojek, grab, busway, KRL, parkir, tol, taxi, motor, BBM
"Belanja & Kebutuhan Rumah" — alfamart, indomaret, supermarket, sabun, deterjen, sembako, beras, minyak
"Kesehatan" — apotek, obat, dokter, klinik, rs, vitamin, masker, BPJS
"Tagihan & Utilitas" — listrik, air, PLN, PDAM, internet, wifi, pulsa, token, cicilan, tagihan
"Hiburan & Lifestyle" — netflix, spotify, bioskop, game, karaoke, spa, gym, baju, sepatu
"Pendidikan & Pekerjaan" — kursus, buku, seminar, pelatihan, domain
"Lainnya" — fallback jika tidak cocok
`;

// Max base64 size ~6.6MB (≈5MB original file)
const MAX_BASE64_SIZE = 6.6 * 1024 * 1024;

/**
 * Shared post-processing: validate categories + confidence fallback.
 */
function processItems(items) {
  return items.map((item) => {
    const confidence = typeof item.confidence === 'number' ? item.confidence : 0;
    const kategori =
      confidence < 0.7 || !VALID_CATEGORIES.includes(item.kategori)
        ? 'Lainnya'
        : item.kategori;

    return {
      nama: String(item.nama || '').slice(0, 100),
      jumlah: Math.round(Number(item.jumlah) || 0),
      kategori,
      tanggal: item.tanggal || null,
      confidence,
    };
  });
}

/**
 * Parse free-form Indonesian text into structured expense items using Gemini AI.
 * @param {string} text - User's raw text message
 * @returns {Promise<{is_expense: boolean, items: Array, error: string|null}>}
 */
async function parseTextExpense(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const result = await model.generateContent(PROMPT_TEMPLATE + text);
    const response = result.response;
    const rawText = response.text();

    // Strip markdown code fences if Gemini wraps the output
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // If not an expense, return early with empty items
    if (!parsed.is_expense) {
      return { is_expense: false, items: [], error: null };
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return { is_expense: true, items: processItems(items), error: null };
  } catch (err) {
    console.error(
      `[GEMINI_ERROR] ${new Date().toISOString()} ${err.message}`
    );
    return { is_expense: false, items: [], error: err.message };
  }
}

/**
 * Parse a receipt/nota photo into structured expense items using Gemini Pro Vision.
 * @param {string} base64Image - Base64-encoded image data
 * @param {string} mimeType - "image/jpeg" | "image/png" | "image/webp"
 * @returns {Promise<{is_expense: boolean, items: Array, error: string|null}>}
 */
async function parseImageExpense(base64Image, mimeType) {
  try {
    // Validate file size (~6.6MB base64 ≈ 5MB original)
    if (Buffer.byteLength(base64Image, 'utf8') > MAX_BASE64_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    };

    const result = await model.generateContent([VISION_PROMPT_TEMPLATE, imagePart]);
    const response = result.response;
    const rawText = response.text();

    // Strip markdown code fences if Gemini wraps the output
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // If Gemini flagged the photo as unreadable
    if (parsed.error) {
      return { is_expense: false, items: [], error: parsed.error };
    }

    if (!parsed.is_expense) {
      return { is_expense: false, items: [], error: null };
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return { is_expense: true, items: processItems(items), error: null };
  } catch (err) {
    console.error(
      `[GEMINI_VISION_ERROR] ${new Date().toISOString()} ${err.message}`
    );
    return { is_expense: false, items: [], error: err.message };
  }
}

module.exports = { parseTextExpense, parseImageExpense };
