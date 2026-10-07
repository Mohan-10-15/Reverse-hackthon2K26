"use strict";

const { guardAdmin, isMongoConfigured, getRegistrations, readJsonBody } = require("../_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Use PATCH." });
  }
  if (!guardAdmin(req, res)) return;
  if (!isMongoConfigured()) return res.status(503).json({ error: "MONGODB_URI is not set on the server." });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) {
    return res.status(e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400)
      .json({ error: "Could not read the score update." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Send the score update as a JSON object." });
  }

  const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim().slice(0, 100) : "";
  let mark = body.mark;
  if (mark === "") mark = null;
  if (typeof mark === "string" && mark !== null) {
    if (!/^\d{1,3}$/.test(mark)) return res.status(400).json({ error: "Enter a whole-number mark from 0 to 100." });
    mark = Number(mark);
  }
  if (!registrationId) return res.status(400).json({ error: "Registration ID is required." });
  if (mark !== null && (!Number.isInteger(mark) || mark < 0 || mark > 100)) {
    return res.status(400).json({ error: "Enter a whole-number mark from 0 to 100, or leave it blank to clear." });
  }

  try {
    const col = await getRegistrations();
    const markUpdatedAt = new Date();
    const result = await col.updateOne(
      { registrationId },
      { $set: { mark, markUpdatedAt } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: "Registration not found." });
    return res.status(200).json({ ok: true, registrationId, mark, markUpdatedAt });
  } catch (e) {
    console.error("admin mark update failed", e && e.message);
    return res.status(503).json({ error: "Could not save the mark." });
  }
};
