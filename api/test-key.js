const GOOGLE_KEY_PREFIX = 'AI' + 'za';
const GOOGLE_KEY_LENGTH = 39;

const STATUS_MESSAGES = {
  OK: 'API key valid untuk request Google API server-side.',
  REQUEST_DENIED: 'Google menolak request. API key salah, project/API belum aktif, billing belum aktif, atau restriction key tidak cocok.',
  OVER_QUERY_LIMIT: 'Kuota API key habis atau terkena limit billing.',
  OVER_DAILY_LIMIT: 'Limit harian atau billing Google Cloud bermasalah.',
  INVALID_REQUEST: 'Request test ke Google tidak valid.',
  UNKNOWN_ERROR: 'Google mengembalikan unknown error. Coba ulang beberapa saat lagi.',
  ZERO_RESULTS: 'API key valid, tetapi query test tidak punya hasil. Ini jarang terjadi untuk query Bali.',
};

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

function looksLikeGoogleApiKey(value) {
  return (
    typeof value === 'string' &&
    value.length === GOOGLE_KEY_LENGTH &&
    value.startsWith(GOOGLE_KEY_PREFIX) &&
    /^[0-9A-Za-z_-]+$/.test(value)
  );
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw || '{}');
}

async function testWithGeocoding(apiKey) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', 'Bali Indonesia');
  url.searchParams.set('language', 'en');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { method: 'GET' });
  const data = await response.json();
  const status = data.status || 'NO_STATUS';

  return {
    httpOk: response.ok,
    status,
    errorMessage: data.error_message || '',
    resultCount: Array.isArray(data.results) ? data.results.length : 0,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, code: 'MethodNotAllowed', message: 'Use POST.' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { ok: false, code: 'InvalidJson', message: 'Request body tidak valid.' });
  }

  const fieldName = 'api' + 'Key';
  const apiKey = String(body[fieldName] || '').trim();
  const testedOrigin = getOrigin(req);

  if (!apiKey) {
    return sendJson(res, 400, { ok: false, code: 'MissingKeyMapError', message: 'API key kosong.', testedOrigin });
  }

  if (!looksLikeGoogleApiKey(apiKey)) {
    return sendJson(res, 200, {
      ok: false,
      code: 'InvalidKeyFormat',
      message: 'Format API key tidak valid. API key Google biasanya diawali AIza dan panjangnya 39 karakter.',
      testedOrigin,
    });
  }

  try {
    const geo = await testWithGeocoding(apiKey);

    if (geo.status === 'OK' || geo.status === 'ZERO_RESULTS') {
      return sendJson(res, 200, {
        ok: true,
        code: geo.status,
        message: 'API key lolos validasi Google Geocoding API. Untuk website autocomplete, pastikan Maps JavaScript API dan Places API juga aktif serta domain sudah diizinkan.',
        testedOrigin,
        details: {
          geocodingStatus: geo.status,
          resultCount: geo.resultCount,
        },
      });
    }

    return sendJson(res, 200, {
      ok: false,
      code: geo.status,
      message: geo.errorMessage || STATUS_MESSAGES[geo.status] || `Google mengembalikan status ${geo.status}.`,
      testedOrigin,
      details: {
        geocodingStatus: geo.status,
      },
    });
  } catch (error) {
    return sendJson(res, 200, {
      ok: false,
      code: 'NetworkError',
      message: error && error.message ? error.message : 'Gagal menghubungi Google API.',
      testedOrigin,
    });
  }
}
