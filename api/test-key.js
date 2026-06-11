const ERROR_MESSAGES = {
  InvalidKeyMapError: "API key salah, sudah dihapus, atau bukan key dari project Google Cloud yang benar.",
  ApiNotActivatedMapError: "Maps JavaScript API belum aktif pada project Google Cloud tersebut.",
  BillingNotEnabledMapError: "Billing belum aktif pada project Google Cloud yang memakai API key ini.",
  RefererNotAllowedMapError: "Domain website ini belum masuk daftar HTTP referrer yang diizinkan untuk API key ini.",
  RequestDeniedMapError: "Request ditolak Google. Biasanya karena konfigurasi API key, billing, API restriction, atau domain restriction belum sesuai.",
  OverQuotaMapError: "Kuota API key habis atau terkena limit billing.",
};

function json(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function detectGoogleMapError(body) {
  const text = String(body || "");
  const match = text.match(/([A-Za-z]+MapError)/);
  if (match) return match[1];

  if (text.includes("Google Maps JavaScript API error")) return "RequestDeniedMapError";
  if (text.includes("gm_authFailure")) return "GoogleMapsAuthFailure";

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, code: "MethodNotAllowed", message: "Use POST." });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (error) {
    return json(res, 400, { ok: false, code: "InvalidJson", message: "Request body tidak valid." });
  }

  const apiKey = String(body.apiKey || "").trim();

  if (!apiKey) {
    return json(res, 400, { ok: false, code: "MissingKeyMapError", message: "API key kosong." });
  }

  if (!apiKey.startsWith("AIza") || apiKey.length !== 39) {
    return json(res, 400, {
      ok: false,
      code: "InvalidKeyFormat",
      message: "Format API key tidak valid. API key Google biasanya diawali AIza dan panjangnya 39 karakter.",
    });
  }

  const origin = getOrigin(req);
  const url = new URL("https://maps.googleapis.com/maps/api/js");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("libraries", "places");
  url.searchParams.set("callback", "__broDewataGoogleMapsTest");
  url.searchParams.set("loading", "async");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Referer: `${origin}/`,
        "User-Agent": "BroDewata-GoogleMaps-Key-Tester/1.0",
      },
    });

    const responseText = await response.text();
    const errorCode = detectGoogleMapError(responseText);

    if (!response.ok) {
      return json(res, 200, {
        ok: false,
        code: errorCode || `GoogleHttp${response.status}`,
        message: ERROR_MESSAGES[errorCode] || `Google mengembalikan HTTP ${response.status}.`,
        testedOrigin: origin,
      });
    }

    if (errorCode) {
      return json(res, 200, {
        ok: false,
        code: errorCode,
        message: ERROR_MESSAGES[errorCode] || "Google Maps JavaScript API menolak API key ini.",
        testedOrigin: origin,
      });
    }

    if (!responseText.includes("__broDewataGoogleMapsTest") && !responseText.includes("google.maps")) {
      return json(res, 200, {
        ok: false,
        code: "UnexpectedGoogleResponse",
        message: "Response Google tidak seperti Maps JavaScript API yang valid.",
        testedOrigin: origin,
      });
    }

    return json(res, 200, {
      ok: true,
      code: "OK",
      message: "API key lolos test server untuk Maps JavaScript API dan Places library.",
      testedOrigin: origin,
    });
  } catch (error) {
    return json(res, 200, {
      ok: false,
      code: "NetworkError",
      message: error && error.message ? error.message : "Gagal menghubungi Google Maps API.",
      testedOrigin: origin,
    });
  }
}
