import nodemailer from "nodemailer";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmail({ to, bcc, subject, html, text }) {
  if (!hasSmtpConfig()) {
    console.log("SMTP is not configured. Email content follows:");
    console.log({ to, bcc, subject, text });
    return { previewOnly: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
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
