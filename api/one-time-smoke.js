const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { getDb, smtpConfigured } = require("./_lib");

// Temporary one-time smoke test; delete immediately after the test completes.
const TOKEN_SHA256 = "244835425136af3ed1457f48998fc4daa5d4b56d417a9eefa5d78f1131a27a41";

function authorized(req) {
  const token = req.headers["x-smoke-token"];
  if (typeof token !== "string" || !token) return false;
  const actual = crypto.createHash("sha256").update(token).digest();
  const expected = Buffer.from(TOKEN_SHA256, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function safeCode(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) ? value : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!authorized(req)) return res.status(404).json({ error: "not_found" });

  const result = {};
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    result.mongo = { ok: true };
  } catch (error) {
    result.mongo = {
      ok: false,
      name: safeCode(error && error.name) || "MongoError",
      code: safeCode(error && error.code),
      topologyType: safeCode(error && error.reason && error.reason.type),
    };
  }

  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]);
  if (missing.length || !smtpConfigured()) {
    result.smtp = { ok: false, reason: "missing_config", missing };
  } else {
    let transporter;
    try {
      const port = Number(process.env.SMTP_PORT) || 465;
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await transporter.verify();
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: process.env.SMTP_USER,
        subject: "Reverse Hackathon SMTP delivery test",
        text: "This is a one-time test email confirming the Reverse Hackathon site's SMTP configuration. No action is required.",
      });
      result.smtp = {
        ok: true,
        verified: true,
        acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : 0,
        rejectedCount: Array.isArray(info.rejected) ? info.rejected.length : 0,
      };
    } catch (error) {
      result.smtp = {
        ok: false,
        name: safeCode(error && error.name) || "MailError",
        code: safeCode(error && error.code),
        responseCode: Number.isFinite(error && error.responseCode) ? error.responseCode : null,
      };
    } finally {
      if (transporter) transporter.close();
    }
  }

  return res.status(200).json(result);
};
