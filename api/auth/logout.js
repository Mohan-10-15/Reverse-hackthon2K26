"use strict";

const { clearTeamSessionCookie, isSameOriginRequest } = require("../_team-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "Request origin not allowed." });
  clearTeamSessionCookie(res);
  return res.status(200).json({ ok: true });
};
