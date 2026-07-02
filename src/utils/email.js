const nodemailer = require('nodemailer');
const { env } = require('../config/env');

// ─── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

// ─── Base HTML wrapper ─────────────────────────────────────────────────────────
const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vexaro</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; letter-spacing: -0.5px; }
    .header span { color: #6c63ff; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .body h2 { margin-top: 0; font-size: 20px; color: #111; }
    .btn { display: inline-block; margin: 20px 0; padding: 14px 28px; background: #6c63ff; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; background: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #888; }
    .note { background: #f0f0ff; border-left: 3px solid #6c63ff; padding: 12px 16px; border-radius: 0 4px 4px 0; font-size: 13px; color: #555; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Vex<span>aro</span></h1></div>
    <div class="body">${content}</div>
    <div class="footer">© ${new Date().getFullYear()} Vexaro Courier Solutions Pvt. Ltd. · <a href="mailto:support@vexaro.in">support@vexaro.in</a></div>
  </div>
</body>
</html>
`;

// ─── Send Invite Email ─────────────────────────────────────────────────────────
const sendInviteEmail = async (opts) => {
  const { to, firstName, role, inviteToken, invitedBy } = opts;
  const setPasswordUrl =
    `${env.FRONTEND_URL}/set-password?token=${inviteToken}`;

  const roleLabel = role.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const html = emailWrapper(`
    <h2>You're invited to Vexaro!</h2>
    <p>Hi <strong>${firstName}</strong>,</p>
    <p><strong>${invitedBy}</strong> has invited you to join Vexaro as a <strong>${roleLabel}</strong>.</p>
    <p>Click the button below to set your password and activate your account:</p>
    <a href="${setPasswordUrl}" class="btn">Accept Invitation →</a>
    <div class="note">⏰ This invite link expires in <strong>${env.INVITE_TOKEN_EXPIRES_HOURS} hours</strong>. If you did not expect this email, you can safely ignore it.</div>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `You're invited to Vexaro as ${roleLabel}`,
    html,
  });

  console.log(`📧 Invite email sent to ${to}`);

  // Dev helper — log the full invite URL to console so you can test without opening email
  if (env.NODE_ENV === 'development') {
    console.log(`\n🔗 [DEV] Invite URL for ${to}:`);
    console.log(`   ${setPasswordUrl}`);
    console.log(`   Token: ${inviteToken}\n`);
  }
};

// ─── Send Password Reset Email ─────────────────────────────────────────────────
const sendResetEmail = async (opts) => {
  const { to, firstName, resetToken } = opts;
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(to)}`;

  const html = emailWrapper(`
    <h2>Reset your password</h2>
    <p>Hi <strong>${firstName}</strong>,</p>
    <p>We received a request to reset your Vexaro account password. Click the button below to choose a new password:</p>
    <a href="${resetUrl}" class="btn">Reset Password →</a>
    <div class="note">⏰ This link expires in <strong>${env.RESET_TOKEN_EXPIRES_HOURS} hours</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</div>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: 'Reset your Vexaro password',
    html,
  });

  console.log(`📧 Reset email sent to ${to}`);
};

// ─── Warehouse Address Change Request Email (to Distributor) ────────────────
const sendWarehouseChangeRequestEmail = async (opts) => {
  const { to, merchantName, warehouseId, currentAddress, requestedAddress } = opts;

  const html = emailWrapper(`
    <h2>New Warehouse Address Change Request</h2>
    <p>Hi Distributor,</p>
    <p>Merchant <strong>${merchantName}</strong> has requested an address change for warehouse <strong>${warehouseId}</strong>.</p>
    <div class="note">
      <p><strong>Current Address:</strong><br>${currentAddress.addressLine}, ${currentAddress.city}, ${currentAddress.state} - ${currentAddress.pincode}</p>
      <p><strong>Requested Address:</strong><br>${requestedAddress.addressLine}, ${requestedAddress.city}, ${requestedAddress.state} - ${requestedAddress.pincode}</p>
    </div>
    <p>Please log in to your Vexaro portal to review and approve or reject this request.</p>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `New Warehouse Address Change Request - ${warehouseId}`,
    html,
  });

  console.log(`📧 Warehouse change request email sent to distributor ${to}`);
};

// ─── Warehouse Address Change Approved Email (to Merchant) ───────────────────
const sendWarehouseChangeApprovedEmail = async (opts) => {
  const { to, warehouseId, newAddress } = opts;

  const html = emailWrapper(`
    <h2>Warehouse Address Change Approved</h2>
    <p>Hi Merchant,</p>
    <p>Your address change request for warehouse <strong>${warehouseId}</strong> has been <strong>approved</strong> by your distributor.</p>
    <div class="note">
      <p><strong>Updated Location:</strong><br>${newAddress.addressLine}, ${newAddress.city}, ${newAddress.state} - ${newAddress.pincode}</p>
    </div>
    <p>Your warehouse profile has been updated automatically.</p>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `Warehouse Address Change Approved - ${warehouseId}`,
    html,
  });

  console.log(`📧 Warehouse change approved email sent to merchant ${to}`);
};

// ─── Warehouse Address Change Rejected Email (to Merchant) ───────────────────
const sendWarehouseChangeRejectedEmail = async (opts) => {
  const { to, warehouseId, rejectionReason } = opts;

  const html = emailWrapper(`
    <h2>Warehouse Address Change Rejected</h2>
    <p>Hi Merchant,</p>
    <p>Your address change request for warehouse <strong>${warehouseId}</strong> was <strong>rejected</strong> by your distributor.</p>
    <div class="note">
      <p><strong>Rejection Reason:</strong><br>${rejectionReason}</p>
    </div>
    <p>Please contact your distributor if you have any questions or require further clarification.</p>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `Warehouse Address Change Rejected - ${warehouseId}`,
    html,
  });

  console.log(`📧 Warehouse change rejected email sent to merchant ${to}`);
};

// ─── Verify SMTP Connection (dev helper) ──────────────────────────────────────
const verifyEmailConfig = async () => {
  if (env.NODE_ENV === 'development' && !env.SMTP_USER) {
    console.log('⚠️  SMTP not configured — emails will be logged only (dev mode)');
    return;
  }
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
  } catch (error) {
    console.warn('⚠️  SMTP verification failed (emails may not send):', error);
  }
};

// ─── Refund Request: Submitted ─────────────────────────────────────────────────
const sendRefundRequestSubmittedEmail = async ({ to, merchantName, awb, amount, reason, requestId }) => {
  const html = emailWrapper(`
    <h2>Refund Request Submitted</h2>
    <p>Hi <strong>${merchantName}</strong>,</p>
    <p>Your refund request has been submitted and is under review.</p>
    <div class="note">
      <strong>Request ID:</strong> ${requestId}<br>
      <strong>AWB:</strong> ${awb}<br>
      <strong>Amount:</strong> ₹${Number(amount).toFixed(2)}<br>
      <strong>Reason:</strong> ${reason}
    </div>
    <p>You will be notified once your request is reviewed. This typically takes 1–3 business days.</p>
    <p>If you have questions, please contact your distributor.</p>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `Refund Request Submitted - AWB ${awb}`,
    html,
  });
};

// ─── Refund Request: Decision (Approved / Rejected) ────────────────────────────
const sendRefundRequestDecisionEmail = async ({ to, merchantName, awb, amount, status, reviewNote, requestId }) => {
  const isApproved = status === 'APPROVED';
  const statusLabel = isApproved ? 'Approved ✅' : 'Rejected ❌';
  const statusColor = isApproved ? '#22c55e' : '#ef4444';

  const html = emailWrapper(`
    <h2>Refund Request ${statusLabel}</h2>
    <p>Hi <strong>${merchantName}</strong>,</p>
    <p>Your refund request for AWB <strong>${awb}</strong> has been <strong style="color:${statusColor}">${status.toLowerCase()}</strong>.</p>
    <div class="note">
      <strong>Request ID:</strong> ${requestId}<br>
      <strong>AWB:</strong> ${awb}<br>
      <strong>Amount:</strong> ₹${Number(amount).toFixed(2)}<br>
      ${reviewNote ? `<strong>Review Note:</strong> ${reviewNote}` : ''}
    </div>
    ${isApproved
      ? '<p>The refund amount has been credited to your wallet. Please check your wallet balance.</p>'
      : '<p>If you believe this decision was made in error, please contact your distributor with supporting information.</p>'
    }
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `Refund Request ${status} - AWB ${awb}`,
    html,
  });
};

// ─── Export Ready Notification ─────────────────────────────────────────────────
const sendExportReadyEmail = async ({ to, firstName, format, exportType, jobId }) => {
  const html = emailWrapper(`
    <h2>Your Export is Ready</h2>
    <p>Hi <strong>${firstName}</strong>,</p>
    <p>Your <strong>${exportType}</strong> export in <strong>${format.toUpperCase()}</strong> format has been generated.</p>
    <div class="note">
      <strong>Job ID:</strong> ${jobId}<br>
      <strong>Export Type:</strong> ${exportType}<br>
      <strong>Format:</strong> ${format.toUpperCase()}
    </div>
    <p>You can download your export by logging in to the Vexaro dashboard and navigating to Reports → Exports.</p>
    <p>Export files are available for 7 days from generation.</p>
  `);

  await transporter.sendMail({
    from: `"Vexaro" <${env.EMAIL_FROM}>`,
    to,
    subject: `Your ${exportType} Export is Ready`,
    html,
  });
};

module.exports = {
  sendInviteEmail,
  sendResetEmail,
  sendWarehouseChangeRequestEmail,
  sendWarehouseChangeApprovedEmail,
  sendWarehouseChangeRejectedEmail,
  sendRefundRequestSubmittedEmail,
  sendRefundRequestDecisionEmail,
  sendExportReadyEmail,
  verifyEmailConfig,
};
