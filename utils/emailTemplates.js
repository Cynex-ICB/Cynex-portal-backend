function getClientUrl() {
  return (process.env.CLIENT_URL || "https://cynexicb.com").replace(/\/$/, "");
}

function getPortalName() {
  return process.env.PORTAL_NAME || "Cynex CSE (ICB) Portal";
}

function getLogoUrl() {
  return process.env.PORTAL_LOGO_URL || `${getClientUrl()}/icons/icon-192.png`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailShell({ title, preheader, greeting, intro, children, footerNote = "" }) {
  const portalName = escapeHtml(getPortalName());
  const clientUrl = getClientUrl();
  const logoUrl = getLogoUrl();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(23,32,51,0.08);">
            <tr>
              <td style="background:#10233f;padding:28px 32px;text-align:left;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:56px;vertical-align:middle;">
                      <img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="${portalName} logo" style="display:block;border-radius:12px;background:#ffffff;">
                    </td>
                    <td style="vertical-align:middle;padding-left:14px;">
                      <div style="font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:#9fd4ff;font-weight:700;">Department Portal</div>
                      <div style="font-size:21px;line-height:28px;color:#ffffff;font-weight:800;">${portalName}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 28px;">
                <h1 style="margin:0 0 14px;font-size:25px;line-height:32px;color:#10233f;font-weight:800;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:25px;color:#34445f;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#52627a;">${escapeHtml(intro)}</p>
                ${children}
                ${
                  footerNote
                    ? `<p style="margin:24px 0 0;font-size:13px;line-height:21px;color:#6d7b91;">${escapeHtml(footerNote)}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafd;border-top:1px solid #e3eaf3;padding:18px 32px;">
                <p style="margin:0;font-size:12px;line-height:19px;color:#6d7b91;">
                  This is an automated message from <a href="${escapeHtml(clientUrl)}" style="color:#1769aa;text-decoration:none;font-weight:700;">${portalName}</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;font-size:13px;line-height:20px;color:#6d7b91;font-weight:700;width:42%;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;font-size:14px;line-height:20px;color:#172033;font-weight:700;">${escapeHtml(value)}</td>
  </tr>`;
}

function primaryButton(label, url) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
    <tr>
      <td style="background:#1769aa;border-radius:8px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:14px;line-height:18px;font-weight:800;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function buildSignupOtpEmail({ name, otp }) {
  return {
    subject: "Verify your Cynex portal account",
    text: `Hello ${name}, your Cynex portal verification OTP is ${otp}. It expires in 10 minutes.`,
    html: emailShell({
      title: "Verify your account",
      preheader: "Use this OTP to complete your Cynex portal signup.",
      greeting: `Hello ${name},`,
      intro: "Use the verification code below to complete your portal signup. This code is valid for 10 minutes.",
      children: `<div style="margin:24px 0;padding:20px;border:1px solid #dbe4f0;border-radius:12px;background:#f8fafd;text-align:center;">
        <div style="font-size:12px;line-height:16px;color:#6d7b91;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">Verification OTP</div>
        <div style="margin-top:8px;font-size:34px;line-height:42px;color:#10233f;font-weight:900;letter-spacing:0.18em;">${escapeHtml(otp)}</div>
      </div>`,
      footerNote: "If you did not request this signup, you can safely ignore this email.",
    }),
  };
}

function buildPasswordResetEmail({ name, resetUrl }) {
  return {
    subject: "Reset your Cynex portal password",
    text: `Hello ${name}, use this link to reset your Cynex portal password: ${resetUrl}. It expires in 1 hour.`,
    html: emailShell({
      title: "Reset your password",
      preheader: "Use this secure link to reset your Cynex portal password.",
      greeting: `Hello ${name},`,
      intro: "We received a request to reset your portal password. Use the button below within 1 hour to choose a new password.",
      children: `${primaryButton("Reset Password", resetUrl)}
        <p style="margin:0;font-size:13px;line-height:21px;color:#6d7b91;">If the button does not work, paste this link into your browser:<br>
        <a href="${escapeHtml(resetUrl)}" style="color:#1769aa;word-break:break-all;">${escapeHtml(resetUrl)}</a></p>`,
      footerNote: "If you did not request a password reset, you can ignore this email.",
    }),
  };
}

function buildTeacherAccountEmail({ name, email, teacherId, role, password }) {
  const loginUrl = getClientUrl();
  const roleLabel = role === "master-admin" ? "Master Admin" : "Teacher Admin";

  return {
    subject: "Your Cynex portal admin account has been created",
    text: `Hello ${name}, your ${roleLabel} account has been created on Cynex portal. Login: ${loginUrl}. Email: ${email}. Teacher Employee ID: ${teacherId}. Temporary password: ${password}.`,
    html: emailShell({
      title: "Admin account created",
      preheader: "Your Cynex portal teacher admin account is ready.",
      greeting: `Hello ${name},`,
      intro: "Your admin account has been created on the department portal. Use the credentials below to sign in.",
      children: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:10px 0 6px;border-top:1px solid #e3eaf3;border-bottom:1px solid #e3eaf3;">
          ${detailRow("Portal Role", roleLabel)}
          ${detailRow("Email", email)}
          ${detailRow("Teacher Employee ID", teacherId)}
          ${detailRow("Temporary Password", password)}
        </table>
        ${primaryButton("Open Portal", loginUrl)}`,
      footerNote: "Please sign in with this temporary password and reset it from the password reset flow if needed.",
    }),
  };
}

export { buildPasswordResetEmail, buildSignupOtpEmail, buildTeacherAccountEmail };
