const form = document.querySelector('#api-key-form');
const input = document.querySelector('#api-key');
const button = document.querySelector('#test-button');
const result = document.querySelector('#result');
const toggle = document.querySelector('#toggle-key');

const VALID_PREFIX = 'AI' + 'za';
const VALID_LEN = 39;

function esc(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function show(type, title, message) {
  result.className = `result is-${type}`;
  result.innerHTML = `<div class="result-title">${esc(title)}</div><p>${esc(message)}</p>`;
}

function titleFromCode(code) {
  const map = {
    MissingKeyMapError: 'Gagal: API key kosong',
    InvalidKeyFormat: 'Gagal: format API key tidak valid',
    InvalidKeyMapError: 'Gagal: API key tidak valid',
    ApiNotActivatedMapError: 'Gagal: Maps JavaScript API belum aktif',
    BillingNotEnabledMapError: 'Gagal: billing belum aktif',
    RefererNotAllowedMapError: 'Gagal: domain tidak diizinkan',
    RequestDeniedMapError: 'Gagal: request ditolak Google',
    OverQuotaMapError: 'Gagal: kuota habis',
    NetworkError: 'Gagal: tidak bisa menghubungi Google',
  };
  return map[code] || `Gagal: ${code || 'error tidak diketahui'}`;
}

function looksLikeGoogleKey(value) {
  if (!value || value.length !== VALID_LEN) return false;
  if (!value.startsWith(VALID_PREFIX)) return false;
  return /^[0-9A-Za-z_-]+$/.test(value);
}

async function runServerTest(value) {
  const payload = {};
  payload['api' + 'Key'] = value;

  const response = await fetch('/api/test-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return {
      ok: false,
      code: 'TesterApiError',
      message: `Endpoint tester mengembalikan HTTP ${response.status}.`,
    };
  }

  return response.json();
}

form.addEventListener('submit', async function (event) {
  event.preventDefault();
  const value = input.value.trim();

  if (!value) {
    show('error', 'Gagal: API key kosong', 'Pastikan field API key sudah diisi.');
    return;
  }

  if (!looksLikeGoogleKey(value)) {
    show(
      'error',
      'Gagal: format API key tidak valid',
      'API key Google biasanya diawali AIza dan panjangnya 39 karakter. Input ini jelas bukan format API key Google Maps yang valid.'
    );
    return;
  }

  button.disabled = true;
  button.textContent = 'Mengetes...';
  show(
    'loading',
    'Sedang mengetes dari server...',
    'Tester mengirim key sekali ke Vercel Serverless Function untuk validasi ke Google Maps API. Key tidak disimpan.'
  );

  try {
    const data = await runServerTest(value);
    if (data.ok) {
      show(
        'success',
        'Lolos: API key valid',
        `${data.message || 'API key valid.'} Domain yang dites: ${data.testedOrigin || window.location.origin}`
      );
    } else {
      show('error', titleFromCode(data.code), data.message || 'API key gagal dites.');
    }
  } catch (error) {
    show('error', 'Gagal: tester error', error.message || 'Terjadi error saat menjalankan tester.');
  } finally {
    button.disabled = false;
    button.textContent = 'Tes';
  }
});

toggle.addEventListener('click', function () {
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  toggle.textContent = hidden ? 'Sembunyi' : 'Lihat';
});
