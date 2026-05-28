import nodemailer from "nodemailer";

let transporter;
let transporterSignature = "";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  const signature = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT || "587",
    process.env.SMTP_SECURE || "false",
    process.env.SMTP_USER,
  ].join("|");

  if (transporter && transporterSignature === signature) {
    return transporter;
  }

  transporterSignature = signature;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    pool: true,
    maxConnections: Number(process.env.SMTP_POOL_CONNECTIONS || 3),
    maxMessages: Number(process.env.SMTP_POOL_MESSAGES || 100),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendEmail({ to, bcc, subject, html, text }) {
  if (!hasSmtpConfig()) {
    console.log("SMTP is not configured. Email content follows:");
    console.log({ to, bcc, subject, text });
    return { previewOnly: true };
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    bcc,
    subject,
    text,
    html,
  });

  return { previewOnly: false };
}

export default sendEmail;
