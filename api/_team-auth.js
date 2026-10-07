"use strict";

const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

const COOKIE_NAME = "rh26_team_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

function sessionKey() {
  // Domain-separated from ADMIN_KEY; setting TEAM_SESSION_SECRET later is optional.
  const root = process.env.TEAM_SESSION_SECRET || process.env.ADMIN_KEY;
  if (typeof root !== "string" || root.length < 32) {
    throw new Error("A long TEAM_SESSION_SECRET or ADMIN_KEY is required for team sessions.");
  }
  return crypto.createHmac("sha256", root).update("reverse-hackathon-2026:team-session:v1").digest();
}

async function hashTeamPassword(password) {
  if (typeof password !== "string") throw new TypeError("Password must be a string.");
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return { passwordSalt: salt.toString("hex"), passwordHash: Buffer.from(derived).toString("hex") };
}

async function verifyTeamPassword(password, saltHex, hashHex) {
  if (typeof password !== "string" || typeof saltHex !== "string" || typeof hashHex !== "string") return false;
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(hashHex)) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = Buffer.from(await scrypt(password, salt, expected.length, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    }));
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

function createTeamSession(registrationId, now = Date.now()) {
  if (typeof registrationId !== "string" || !registrationId || registrationId.length > 100) {
    throw new TypeError("A valid registration ID is required.");
  }
  const payload = Buffer.from(JSON.stringify({ r: registrationId, e: now + SESSION_TTL_MS })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyTeamSession(token, now = Date.now()) {
  if (typeof token !== "string" || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  try {
    const expected = crypto.createHmac("sha256", sessionKey()).update(parts[0]).digest();
    const supplied = Buffer.from(parts[1], "base64url");
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!data || typeof data.r !== "string" || !data.r || !Number.isFinite(data.e) || data.e <= now) return null;
    if (data.e > now + SESSION_TTL_MS + 60_000) return null;
    return { registrationId: data.r, expiresAt: data.e };
  } catch (_) {
    return null;
  }
}

function sessionTokenFromRequest(req) {
  const cookie = String((req.headers && req.headers.cookie) || "");
  for (const part of cookie.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== COOKIE_NAME) continue;
    const value = part.slice(i + 1).trim();
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }
  return "";
}

function teamSessionFromRequest(req) {
  return verifyTeamSession(sessionTokenFromRequest(req));
}

function setTeamSessionCookie(res, token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (process.env.VERCEL === "1") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearTeamSessionCookie(res) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (process.env.VERCEL === "1") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function isSameOriginRequest(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return true;
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = forwardedHost || req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === String(host).split(",")[0].trim().toLowerCase();
  } catch (_) {
    return false;
  }
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  hashTeamPassword,
  verifyTeamPassword,
  createTeamSession,
  verifyTeamSession,
  sessionTokenFromRequest,
  teamSessionFromRequest,
  setTeamSessionCookie,
  clearTeamSessionCookie,
  isSameOriginRequest,
};
