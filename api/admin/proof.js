/**
 * GET /api/admin/proof?id=<registrationId>
 *
 * Streams one stored UPI screenshot back to the organiser. Requires
 * x-admin-key. Images are served with a private, no-store cache policy so a
 * leaked URL cannot be replayed from a browser cache.
 */

const { guardAdmin, isMongoConfigured, getRegistrations } = require("../_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }

  if (!guardAdmin(req, res)) return;

  if (!isMongoConfigured()) {
    return res.status(503).json({ error: "MONGODB_URI is not set on the server." });
  }

  const id = req.query && req.query.id ? String(req.query.id).trim() : "";
  if (!id) return res.status(400).json({ error: "Pass ?id=<registrationId>." });

  try {
    const col = await getRegistrations();
    const doc = await col.findOne(
      { registrationId: id },
      { projection: { "payment.proof": 1 } }
    );

    if (!doc || !doc.payment || !doc.payment.proof || !doc.payment.proof.bytes) {
      return res.status(404).json({ error: "No screenshot stored for that registration." });
    }

    const { mimeType, filename } = doc.payment.proof;
    const bytes = doc.payment.proof.bytes;

    // Binary#value(true) returns a Buffer over exactly this value's byte range.
    // Reading .buffer directly would ignore a sub-binary's offset/length.
    const buffer = Buffer.isBuffer(bytes)
      ? bytes
      : typeof bytes.value === "function"
        ? bytes.value(true)
        : Buffer.from(bytes.buffer || bytes);

    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${(filename || "proof").replace(/[^\w.\-]+/g, "_")}"`
    );
    return res.status(200).end(buffer);
  } catch (e) {
    console.error("admin proof failed", e);
    return res.status(503).json({ error: "Could not read that screenshot." });
  }
};