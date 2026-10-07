"use strict";

const { isMongoConfigured, getRegistrations, readJsonBody } = require("../_lib");
const { teamSessionFromRequest, clearTeamSessionCookie, isSameOriginRequest } = require("../_team-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "Request origin not allowed." });

  const session = teamSessionFromRequest(req);
  if (!session) {
    clearTeamSessionCookie(res);
    return res.status(401).json({ error: "Your team session has expired. Sign in again." });
  }
  if (!isMongoConfigured()) return res.status(503).json({ error: "The team registry is unavailable. Try again shortly." });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) {
    return res.status(e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400)
      .json({ error: "Could not read the workspace submission." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Send a workspace submission as a JSON object." });
  }

  const problemStatement = typeof body.problemStatement === "string" ? body.problemStatement.trim() : "";
  const solution = typeof body.solution === "string" ? body.solution.trim() : "";
  const fieldErrors = {};
  if (problemStatement.length > 5000) fieldErrors.problemStatement = ["Keep the problem statement within 5,000 characters."];
  if (solution.length > 8000) fieldErrors.solution = ["Keep the solution within 8,000 characters."];
  if (Object.keys(fieldErrors).length) return res.status(400).json({ error: "Shorten the highlighted field(s).", fieldErrors });

  try {
    const col = await getRegistrations();
    const workspaceUpdatedAt = new Date();
    const result = await col.updateOne(
      { registrationId: session.registrationId },
      { $set: { problemStatement, solution, workspaceUpdatedAt } }
    );
    if (!result.matchedCount) {
      clearTeamSessionCookie(res);
      return res.status(401).json({ error: "This team account is no longer available." });
    }
    return res.status(200).json({ ok: true, workspaceUpdatedAt });
  } catch (e) {
    console.error("team workspace save failed", e && e.message);
    return res.status(503).json({ error: "The submission could not be saved. Try again shortly." });
  }
};
