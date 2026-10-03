const crypto = require("node:crypto");
const { getDb } = require("./_lib");

// Temporary diagnostic route; remove immediately after the Production ping.
const EXPECTED_TOKEN_SHA256 = "859717487594ec06aa8581c451fe429b6cbb08d834e455ca6b5b590e84dc1d2e";

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
    let nodes = [];
    try {
      const map = error && error.reason && error.reason.servers;
      if (map && typeof map.values === "function") {
        nodes = [...map.values()].map(server => ({
          type: server && typeof server.type === "string" ? server.type : undefined,
          error: server && server.error && typeof server.error.name === "string" ? server.error.name : undefined,
          code: server && server.error && typeof server.error.code === "string" ? server.error.code : undefined,
        }));
      }
    } catch (_) {}
    const topology = error && error.reason && typeof error.reason.type === "string" ? error.reason.type : undefined;
    const cause = error && error.cause;
    const code = cause && typeof cause.code === "string" ? cause.code : undefined;
    const failure = error && error.name === "MongoServerSelectionError" ? "server-selection-timeout" : "database-error";
    console.error("MongoDB ping failed", error && error.name ? error.name : "Error", failure, code || "no-code");
    return res.status(503).json({ ok: false, error: error && error.name ? error.name : "DatabaseError", failure, topology, code, nodes });
  }
};
