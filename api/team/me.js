"use strict";

const { isMongoConfigured, getRegistrations } = require("../_lib");
const { teamSessionFromRequest, clearTeamSessionCookie } = require("../_team-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }
  const session = teamSessionFromRequest(req);
  if (!session) {
    clearTeamSessionCookie(res);
    return res.status(401).json({ error: "Sign in to open your team workspace." });
  }
  if (!isMongoConfigured()) return res.status(503).json({ error: "The team registry is unavailable. Try again shortly." });

  try {
    const col = await getRegistrations();
    const registration = await col.findOne(
      { registrationId: session.registrationId },
      {
        projection: {
          registrationId: 1,
          teamName: 1,
          entryFormat: 1,
          headcount: 1,
          domain: 1,
          "leader.fullName": 1,
          "partner.fullName": 1,
          problemStatement: 1,
          solution: 1,
          mark: 1,
          workspaceUpdatedAt: 1,
          markUpdatedAt: 1,
        },
      }
    );
    if (!registration) {
      clearTeamSessionCookie(res);
      return res.status(401).json({ error: "This team account is no longer available." });
    }

    return res.status(200).json({
      team: {
        registrationId: registration.registrationId,
        teamName: registration.teamName,
        entryFormat: registration.entryFormat,
        headcount: registration.headcount,
        domain: registration.domain,
        leader: { fullName: registration.leader && registration.leader.fullName || "" },
        partner: registration.partner ? { fullName: registration.partner.fullName || "" } : null,
        problemStatement: registration.problemStatement || "",
        solution: registration.solution || "",
        mark: Number.isInteger(registration.mark) && registration.mark >= 0 && registration.mark <= 100 ? registration.mark : null,
        workspaceUpdatedAt: registration.workspaceUpdatedAt || null,
        markUpdatedAt: registration.markUpdatedAt || null,
      },
    });
  } catch (e) {
    console.error("team workspace read failed", e && e.message);
    return res.status(503).json({ error: "The team workspace could not be loaded. Try again shortly." });
  }
};
