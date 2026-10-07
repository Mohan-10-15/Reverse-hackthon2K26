"use strict";

const { isMongoConfigured, getRegistrations, readJsonBody } = require("../_lib");
const { verifyTeamPassword, createTeamSession, setTeamSessionCookie, isSameOriginRequest } = require("../_team-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "Request origin not allowed." });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) {
    return res.status(e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400)
      .json({ error: "Could not read the sign-in details." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Send sign-in details as a JSON object." });
  }

  const username = typeof body.username === "string" ? body.username.trim().slice(0, 60) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length < 2 || password.length < 8 || password.length > 72) {
    return res.status(401).json({ error: "Team name or password is incorrect." });
  }
  if (!isMongoConfigured()) return res.status(503).json({ error: "The team registry is unavailable. Try again shortly." });

  try {
    const col = await getRegistrations();
    const account = await col.findOne(
      { teamNameKey: username.toLowerCase() },
      { projection: { registrationId: 1, passwordSalt: 1, passwordHash: 1 } }
    );
    const valid = account && await verifyTeamPassword(password, account.passwordSalt, account.passwordHash);
    if (!valid) return res.status(401).json({ error: "Team name or password is incorrect." });

    const token = createTeamSession(account.registrationId);
    setTeamSessionCookie(res, token);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("team login failed", e && e.message);
    return res.status(503).json({ error: "The team registry is unavailable. Try again shortly." });
  }
};
