const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail loudly rather than silently signing every session with a known,
  // source-committed fallback secret (which would let anyone forge a valid
  // odg-auth token). Set JWT_SECRET in the environment.
  throw new Error("JWT_SECRET is not set — refusing to start with an insecure session secret.");
}

// Helper function to get cryptographic key
async function getSubtleKey() {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Convert binary buffer to base64url string
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binStr = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Convert base64url string to binary Uint8Array
function base64UrlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binStr = atob(padded);
  const buf = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    buf[i] = binStr.charCodeAt(i);
  }
  return buf;
}

// Encode JSON to base64url
function jsonToBase64Url(obj: any): string {
  const str = JSON.stringify(obj);
  // Using TextEncoder to handle UTF-8 chars correctly in base64
  const bytes = new TextEncoder().encode(str);
  let binStr = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Decode base64url to JSON
function base64UrlToJson(base64url: string): any {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binStr = atob(padded);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  const str = new TextDecoder().decode(bytes);
  return JSON.parse(str);
}

export async function signSession(payload: any): Promise<string> {
  const header = jsonToBase64Url({ alg: "HS256", typ: "JWT" });
  const payloadWithExp = {
    ...payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
  };
  const payloadEncoded = jsonToBase64Url(payloadWithExp);
  const message = `${header}.${payloadEncoded}`;

  const key = await getSubtleKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  const signatureEncoded = bufferToBase64Url(signature);
  return `${message}.${signatureEncoded}`;
}

export async function verifySession(token: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payloadEncoded, signatureEncoded] = parts;

    // Pin the algorithm — only HS256 is ever issued (see signSession). Rejecting
    // anything else closes the classic "alg" confusion / "alg: none" footgun.
    const headerObj = base64UrlToJson(header);
    if (headerObj?.alg !== "HS256") return null;

    const message = `${header}.${payloadEncoded}`;

    const key = await getSubtleKey();
    const sigBuffer = base64UrlToBuffer(signatureEncoded);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer as any,
      new TextEncoder().encode(message)
    );

    if (!valid) return null;

    const payload = base64UrlToJson(payloadEncoded);
    if (payload.exp && payload.exp < Date.now()) {
      return null; // expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}
