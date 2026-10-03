/**
 * GET /api/admin/registrations
 *
 * Returns every registration (screenshot bytes stripped out) plus the totals
 * the dashboard header shows. Requires the x-admin-key header.
 */

const { guardAdmin, isMongoConfigured, getRegistrations } = require("../_lib");

/** Excludes the raw screenshot so the list stays small. */
const LIST_PROJECTION = { "payment.proof.bytes": 0 };

module.exports = async function handler(req, res) {
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

    const registrations = docs.map((doc) => {
      const { payment, ...rest } = doc;
      const { bytes, ...proof } = payment.proof;
      return {
        ...rest,
        payment: { upiTransactionId: payment.upiTransactionId, proof },
      };
    });

    const totals = registrations.reduce(
      (acc, r) => {
        acc.registrations += 1;
        acc.participants += r.headcount;
        acc.amountCollected += r.amountDue;
        if (r.entryFormat === "duo") acc.duo += 1;
        else acc.solo += 1;
        return acc;
      },
      { registrations: 0, participants: 0, amountCollected: 0, solo: 0, duo: 0 }
    );

    return res.status(200).json({ registrations, totals });
  } catch (e) {
    console.error("admin list failed", e);
    return res.status(503).json({ error: "Could not read registrations from the registry." });
  }
};