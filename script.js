const form = document.querySelector("#api-key-form");
const apiKeyInput = document.querySelector("#api-key");
const testButton = document.querySelector("#test-button");
const resultBox = document.querySelector("#result");
const toggleKeyButton = document.querySelector("#toggle-key");

const ERROR_EXPLANATIONS = {
  InvalidKeyMapError: {
    title: "Gagal: API key tidak valid",
    message:
      "API key salah, sudah dihapus, atau bukan key dari project Google Cloud yang benar. Coba cek kembali key di Google Cloud Console.",
  },
  ApiNotActivatedMapError: {
    title: "Gagal: Maps JavaScript API belum aktif",
    message:
      "API key ada, tetapi layanan Maps JavaScript API belum di-enable pada project Google Cloud tersebut.",
  },
  BillingNotEnabledMapError: {
    title: "Gagal: Billing belum aktif",
    message:
      "Google Maps Platform membutuhkan billing aktif. Aktifkan billing pada project Google Cloud yang memakai API key ini.",
  },
  RefererNotAllowedMapError: {
    title: "Gagal: Domain tidak diizinkan",
    message:
      "API key dibatasi oleh HTTP referrer, tetapi domain website ini belum masuk daftar izin. Tambahkan domain Vercel atau localhost ke restriction API key.",
  },
  RequestDeniedMapError: {
    title: "Gagal: Request ditolak",
    message:
      "Google menolak request. Biasanya karena konfigurasi API key, billing, restriction, atau API service belum sesuai.",
  },
  OverQuotaMapError: {
    title: "Gagal: Kuota habis",
    message:
      "API key sudah melewati batas kuota atau limit billing. Cek quota dan billing di Google Cloud Console.",
  },
  MissingKeyMapError: {
    title: "Gagal: API key kosong",
    message: "Google Maps tidak menerima API key. Pastikan field API key sudah diisi.",
  },
};

let activeScript = null;
let timeoutId = null;
let callbackName = null;
let authFailureError = null;

function setResult(type, title, message) {
  resultBox.className = `result is-${type}`;
  resultBox.innerHTML = `
    <div class="result-title">${escapeHtml(title)}</div>
    <p>${escapeHtml(message)}</p>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function explainError(errorCode) {
  if (ERROR_EXPLANATIONS[errorCode]) {
    return ERROR_EXPLANATIONS[errorCode];
  }

  return {
    title: `Gagal: ${errorCode || "Error tidak diketahui"}`,
    message:
      "Google Maps API gagal dimuat. Cek apakah API key benar, billing aktif, Maps JavaScript API sudah aktif, dan domain website sudah diizinkan.",
  };
}

function cleanupPreviousTest() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  if (activeScript) {
    activeScript.remove();
    activeScript = null;
  }

  if (callbackName && window[callbackName]) {
    delete window[callbackName];
  }

  callbackName = null;
  authFailureError = null;

  if (window.google?.maps) {
    // Google Maps script yang sudah berhasil diload tidak mudah di-unload penuh.
    // Untuk test berikutnya, halaman bisa direfresh otomatis secara manual bila perlu.
  }
}

function testGoogleMapsApiKey(apiKey) {
  cleanupPreviousTest();

  return new Promise((resolve, reject) => {
    callbackName = `initGoogleMapTest_${Date.now()}`;

    window.gm_authFailure = function () {
      authFailureError = "RequestDeniedMapError";
      reject(new Error(authFailureError));
    };

    window[callbackName] = function () {
      if (window.google?.maps) {
        resolve();
      } else {
        reject(new Error("GoogleMapsObjectMissing"));
      }
    };

    activeScript = document.createElement("script");
    activeScript.async = true;
    activeScript.defer = true;
    activeScript.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&callback=${callbackName}&loading=async`;

    activeScript.onerror = function () {
      reject(new Error(authFailureError || "NetworkOrScriptLoadError"));
    };

    timeoutId = setTimeout(() => {
      reject(new Error(authFailureError || "Timeout"));
    }, 12000);

    document.head.appendChild(activeScript);
  }).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    const explanation = explainError("MissingKeyMapError");
    setResult("error", explanation.title, explanation.message);
    return;
  }

  testButton.disabled = true;
  testButton.textContent = "Mengetes...";
  setResult(
    "loading",
    "Sedang mengetes...",
    "Browser sedang mencoba memuat Google Maps JavaScript API memakai key ini."
  );

  try {
    await testGoogleMapsApiKey(apiKey);
    setResult(
      "success",
      "Lolos: API key berhasil dipakai",
      "Google Maps JavaScript API berhasil dimuat. Artinya key valid untuk website ini, API aktif, dan restriction/referrer saat ini diizinkan."
    );
  } catch (error) {
    const errorCode = error?.message || authFailureError;
    const explanation = explainError(errorCode);
    setResult("error", explanation.title, explanation.message);
  } finally {
    testButton.disabled = false;
    testButton.textContent = "Tes";
  }
});

toggleKeyButton.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyButton.textContent = isPassword ? "Sembunyi" : "Lihat";
});
