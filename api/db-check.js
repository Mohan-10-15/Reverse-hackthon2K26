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
    const serverErrors = [];
    try {
      for (const server of error && error.reason && error.reason.servers && error.reason.servers.values()
        ? error.reason.servers.values()
        : []) {
        if (server && server.error) serverErrors.push(server.error);
      }
    } catch (_) {}
    const cause = (error && error.cause) || serverErrors[0] || error;
    const code = cause && typeof cause.code === "string" ? cause.code : undefined;
    let failure = "database-error";
    if (error && error.name === "MongoServerSelectionError") failure = "server-selection-timeout";
    if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) failure = "dns-resolution";
    if (["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) failure = "network-reachability";
    if (error && error.name === "MongoServerError" && (error.code === 18 || error.codeName === "AuthenticationFailed")) failure = "authentication";
    const topology = error && error.reason && typeof error.reason.type === "string" ? error.reason.type : undefined;
    console.error("MongoDB ping failed", error && error.name ? error.name : "Error", failure, code || "no-code");
    return res.status(503).json({ ok: false, error: error && error.name ? error.name : "DatabaseError", failure, code, topology });
  }
};
