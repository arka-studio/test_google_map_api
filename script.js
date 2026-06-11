const form = document.querySelector("#api-key-form");
const apiKeyInput = document.querySelector("#api-key");
const testButton = document.querySelector("#test-button");
const resultBox = document.querySelector("#result");
const toggleKeyButton = document.querySelector("#toggle-key");

const ERROR_EXPLANATIONS = {
  InvalidKeyMapError: {
    title: "Gagal: API key tidak valid",
    message:
      "API key salah, sudah dihapus, atau bukan key dari project Google Cloud yang benar.",
  },
  ApiNotActivatedMapError: {
    title: "Gagal: Maps JavaScript API belum aktif",
    message:
      "API key ada, tetapi Maps JavaScript API belum diaktifkan pada project Google Cloud tersebut.",
  },
  BillingNotEnabledMapError: {
    title: "Gagal: Billing belum aktif",
    message:
      "Google Maps Platform membutuhkan billing aktif. Aktifkan billing pada project Google Cloud yang memakai API key ini.",
  },
  RefererNotAllowedMapError: {
    title: "Gagal: Domain tidak diizinkan",
    message:
      "API key dibatasi oleh HTTP referrer, tetapi domain website ini belum masuk daftar izin. Tambahkan domain ini ke restriction API key.",
  },
  RequestDeniedMapError: {
    title: "Gagal: Request ditolak",
    message:
      "Google menolak request. Biasanya karena konfigurasi API key, billing, restriction, atau API service belum sesuai.",
  },
  GoogleMapsAuthFailure: {
    title: "Gagal: autentikasi Google Maps ditolak",
    message:
      "Google Maps memanggil auth failure. Artinya key tidak valid untuk domain ini, billing belum aktif, API belum aktif, atau restriction belum cocok.",
  },
  PlacesLibraryMissing: {
    title: "Gagal: Places library tidak tersedia",
    message:
      "Maps JavaScript API berhasil dimuat, tetapi library Places tidak tersedia. Aktifkan Places API dan pastikan script memuat libraries=places.",
  },
  GoogleMapsObjectMissing: {
    title: "Gagal: Google Maps object tidak tersedia",
    message:
      "Script Google Maps selesai dipanggil, tetapi object google.maps tidak tersedia. Biasanya karena key/API/restriction bermasalah.",
  },
  GoogleMapsScriptLoadError: {
    title: "Gagal: script Google Maps tidak bisa dimuat",
    message:
      "Browser gagal memuat script Google Maps. Cek koneksi, domain restriction, API key, atau kemungkinan script diblokir.",
  },
  GoogleMapsRuntimeError: {
    title: "Gagal: error saat membuat map",
    message:
      "Script berhasil dipanggil, tetapi gagal saat membuat map/autocomplete. Cek konfigurasi Maps JavaScript API dan Places API.",
  },
  Timeout: {
    title: "Gagal: waktu tes habis",
    message:
      "Google Maps tidak memberi respons valid dalam batas waktu. Cek koneksi, billing, API key, dan restriction domain.",
  },
  MissingKeyMapError: {
    title: "Gagal: API key kosong",
    message: "Pastikan field API key sudah diisi.",
  },
};

let activeFrame = null;
let timeoutId = null;
let currentTestId = null;
let messageHandler = null;

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

function detectMapErrorCode(message) {
  const text = String(message || "");
  const match = text.match(/([A-Za-z]+MapError)/);
  return match ? match[1] : null;
}

function explainError(errorCode, fallbackMessage) {
  const detectedCode = detectMapErrorCode(fallbackMessage) || errorCode;

  if (ERROR_EXPLANATIONS[detectedCode]) {
    return ERROR_EXPLANATIONS[detectedCode];
  }

  return {
    title: `Gagal: ${detectedCode || "Error tidak diketahui"}`,
    message:
      fallbackMessage ||
      "Google Maps API gagal dites. Cek API key, billing, API yang aktif, dan restriction domain.",
  };
}

function cleanupPreviousTest() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  if (messageHandler) {
    window.removeEventListener("message", messageHandler);
    messageHandler = null;
  }

  if (activeFrame) {
    activeFrame.remove();
    activeFrame = null;
  }

  currentTestId = null;
}

function buildIsolatedTesterHtml(apiKey, testId) {
  const safeApiKey = JSON.stringify(apiKey);
  const safeTestId = JSON.stringify(testId);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <div id="map" style="width:220px;height:160px"></div>
  <input id="places-input" />
  <script>
    (function () {
      var apiKey = ${safeApiKey};
      var testId = ${safeTestId};
      var callbackName = "__googleMapsTesterCallback_" + Date.now();
      var done = false;
      var lastConsoleError = "";

      function post(ok, code, message) {
        if (done) return;
        done = true;
        parent.postMessage({
          type: "GOOGLE_MAPS_API_TEST_RESULT",
          testId: testId,
          ok: ok,
          code: code,
          message: message || lastConsoleError || ""
        }, "*");
      }

      function detectMapErrorCode(message) {
        var text = String(message || "");
        var match = text.match(/([A-Za-z]+MapError)/);
        return match ? match[1] : null;
      }

      var originalConsoleError = console.error;
      console.error = function () {
        var args = Array.prototype.slice.call(arguments).map(function (item) {
          try { return typeof item === "string" ? item : JSON.stringify(item); }
          catch (error) { return String(item); }
        });
        lastConsoleError = args.join(" ");
        var code = detectMapErrorCode(lastConsoleError);
        if (code) {
          post(false, code, lastConsoleError);
        }
        if (originalConsoleError) {
          originalConsoleError.apply(console, arguments);
        }
      };

      window.gm_authFailure = function () {
        post(false, "GoogleMapsAuthFailure", lastConsoleError || "Google Maps auth failure callback triggered.");
      };

      window.addEventListener("error", function (event) {
        var targetSrc = event.target && event.target.src ? String(event.target.src) : "";
        if (targetSrc.indexOf("maps.googleapis.com/maps/api/js") !== -1) {
          post(false, "GoogleMapsScriptLoadError", "Google Maps script failed to load.");
          return;
        }

        var message = event.message || "";
        var code = detectMapErrorCode(message);
        if (code) {
          post(false, code, message);
        }
      }, true);

      window[callbackName] = function () {
        try {
          if (!window.google || !google.maps) {
            post(false, "GoogleMapsObjectMissing", "window.google.maps is missing after callback.");
            return;
          }

          if (!google.maps.places) {
            post(false, "PlacesLibraryMissing", "google.maps.places is missing after loading libraries=places.");
            return;
          }

          var mapElement = document.getElementById("map");
          var map = new google.maps.Map(mapElement, {
            center: { lat: -8.4095, lng: 115.1889 },
            zoom: 10
          });

          var input = document.getElementById("places-input");
          new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: "id" }
          });

          google.maps.event.addListenerOnce(map, "idle", function () {
            setTimeout(function () {
              post(true, "OK", "Maps JavaScript API and Places library loaded, map initialized, and no auth failure was detected.");
            }, 2500);
          });

          setTimeout(function () {
            post(true, "OK", "Maps JavaScript API and Places library loaded, and no auth failure was detected after waiting.");
          }, 5500);
        } catch (error) {
          post(false, "GoogleMapsRuntimeError", error && error.message ? error.message : String(error));
        }
      };

      var script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.onerror = function () {
        post(false, "GoogleMapsScriptLoadError", "Google Maps script failed to load.");
      };
      script.src = "https://maps.googleapis.com/maps/api/js?" +
        "key=" + encodeURIComponent(apiKey) +
        "&libraries=places" +
        "&callback=" + encodeURIComponent(callbackName) +
        "&loading=async";
      document.head.appendChild(script);

      setTimeout(function () {
        post(false, "Timeout", lastConsoleError || "Google Maps test timeout.");
      }, 15000);
    })();
  <\/script>
</body>
</html>`;
}

function testGoogleMapsApiKey(apiKey) {
  cleanupPreviousTest();

  currentTestId = `test_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve, reject) => {
    messageHandler = function (event) {
      const data = event.data || {};
      if (
        data.type !== "GOOGLE_MAPS_API_TEST_RESULT" ||
        data.testId !== currentTestId
      ) {
        return;
      }

      if (data.ok) {
        resolve(data);
      } else {
        reject(Object.assign(new Error(data.code || "GoogleMapsTestFailed"), data));
      }
    };

    window.addEventListener("message", messageHandler);

    activeFrame = document.createElement("iframe");
    activeFrame.setAttribute("aria-hidden", "true");
    activeFrame.style.position = "fixed";
    activeFrame.style.left = "-9999px";
    activeFrame.style.top = "-9999px";
    activeFrame.style.width = "240px";
    activeFrame.style.height = "180px";
    activeFrame.style.border = "0";
    activeFrame.srcdoc = buildIsolatedTesterHtml(apiKey, currentTestId);
    document.body.appendChild(activeFrame);

    timeoutId = setTimeout(() => {
      reject(new Error("Timeout"));
    }, 17000);
  }).finally(() => {
    cleanupPreviousTest();
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
    "Sedang mengetes lebih ketat...",
    "Tester membuat iframe terpisah, memuat Maps JavaScript API + Places, membuat map kecil, lalu menunggu auth failure dari Google."
  );

  try {
    await testGoogleMapsApiKey(apiKey);
    setResult(
      "success",
      "Lolos: API key benar-benar berhasil",
      "Maps JavaScript API dan Places library berhasil dimuat, map berhasil dibuat, dan tidak ada auth failure yang terdeteksi untuk domain ini."
    );
  } catch (error) {
    const explanation = explainError(error?.code || error?.message, error?.message);
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
