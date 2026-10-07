/**
 * GET /api/admin/registrations
 *
 * Returns registrations and the format/headcount totals shown in the dashboard.
 * Requires the x-admin-key header.
 */

const { guardAdmin, isMongoConfigured, getRegistrations } = require("../_lib");

/** An explicit allowlist keeps password hashes and other private fields off the dashboard. */
const LIST_PROJECTION = {
  _id: 0,
  registrationId: 1,
  entryFormat: 1,
  teamName: 1,
  headcount: 1,
  leader: 1,
  partner: 1,
  domain: 1,
  heardAbout: 1,
  submittedAt: 1,
  problemStatement: 1,
  solution: 1,
  mark: 1,
  workspaceUpdatedAt: 1,
  markUpdatedAt: 1,
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }

  if (!guardAdmin(req, res)) return;

  if (!isMongoConfigured()) {
    return res.status(503).json({ error: "MONGODB_URI is not set on the server." });
  }

  try {
    const col = await getRegistrations();
    const docs = await col.find({}, { projection: LIST_PROJECTION }).sort({ submittedAt: -1 }).toArray();

    const registrations = docs;

    const totals = registrations.reduce(
      (acc, r) => {
        acc.registrations += 1;
        acc.participants += r.headcount;
        if (r.entryFormat === "duo") acc.duo += 1;
        else acc.solo += 1;
        if ((typeof r.problemStatement === "string" && r.problemStatement.trim()) || (typeof r.solution === "string" && r.solution.trim())) acc.submissions += 1;
        if (Number.isInteger(r.mark) && r.mark >= 0 && r.mark <= 100) acc.marked += 1;
        return acc;
      },
      { registrations: 0, participants: 0, solo: 0, duo: 0, submissions: 0, marked: 0 }
    );

    return res.status(200).json({ registrations, totals });
  } catch (e) {
    console.error("admin list failed", e);
    return res.status(503).json({ error: "Could not read registrations from the registry." });
  }
};
