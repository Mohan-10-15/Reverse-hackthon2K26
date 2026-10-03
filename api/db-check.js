const crypto = require("node:crypto");
const { getDb } = require("./_lib");

// Temporary diagnostic route. Remove immediately after the production ping.
const EXPECTED_TOKEN_SHA256 = "d7609cd01bf38673068e2d9c6f8d0be834a44ad30e3edc33f06014bb992db1aa";

module.exports = async function handler(req, res) {
  const supplied = req.headers["x-db-check-token"];
  if (typeof supplied !== "string") return res.status(404).end();
  const actual = crypto.createHash("sha256").update(supplied).digest();
  const expected = Buffer.from(EXPECTED_TOKEN_SHA256, "hex");
  if (!crypto.timingSafeEqual(actual, expected)) return res.status(404).end();

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return res.status(200).json({ ok: true });
  } catch (error) {
    // Never include the URI or exception message in the response/log.
    console.error("MongoDB ping failed", error && error.name ? error.name : "Error");
    return res.status(503).json({ ok: false, error: error && error.name ? error.name : "DatabaseError" });
  }
};
