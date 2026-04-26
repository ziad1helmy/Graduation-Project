import { env } from '../config/env.js';

const emailLogoUrl =
  env.EMAIL_LOGO_URL ||
  'https://res.cloudinary.com/dlyhmtquc/image/upload/v1776295472/logo_u0f2pk.png';

const BRAND = {
  primary: '#C62828',
  primaryDark: '#8E1C1C',
  accent: '#FFF5F5',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
  success: '#166534',
};

const renderShell = ({ title, preheader, content }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background:#F3F4F6; font-family:Arial, Helvetica, sans-serif; color:${BRAND.text};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6; padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; background:#FFFFFF; border-radius:18px; overflow:hidden; box-shadow:0 12px 30px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="padding:32px 32px 16px; text-align:center; background:linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%);">
              <img src="${emailLogoUrl}" alt="LifeLink" width="140" style="display:block; margin:0 auto 12px;">
              <p style="margin:0; color:#FEE2E2; font-size:13px; letter-spacing:0.08em; text-transform:uppercase;">LifeLink</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px; border-top:1px solid ${BRAND.border}; color:${BRAND.muted}; font-size:12px; line-height:1.7;">
              This message was sent by LifeLink. If you were not expecting it, you can safely ignore it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const confirmEmailTemplate = (link, name = 'LifeLink user') =>
  renderShell({
    title: 'Verify Your LifeLink Email',
    preheader: 'Verify your email address to activate your LifeLink account.',
    content: `
      <p style="margin:0 0 10px; color:${BRAND.primary}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Account verification</p>
      <h1 style="margin:0 0 16px; font-size:30px; line-height:1.2;">Verify Your Email Address</h1>
      <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">Hello ${name},</p>
      <p style="margin:0 0 24px; font-size:16px; line-height:1.7;">
        Please confirm your email address to finish activating your LifeLink account and continue using the platform.
      </p>
      <div style="margin:0 0 24px;">
        <a href="${link}" style="display:inline-block; padding:14px 24px; background:${BRAND.primary}; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:700;">
          Verify Email
        </a>
      </div>
      <p style="margin:0 0 8px; font-size:14px; color:${BRAND.muted};">If the button does not open, copy this link into your browser:</p>
      <p style="margin:0; word-break:break-all; font-size:14px;">
        <a href="${link}" style="color:${BRAND.primary}; text-decoration:none;">${link}</a>
      </p>
    `,
  });

export const resetPasswordTemplate = (link, name = 'LifeLink user') =>
  renderShell({
    title: 'Reset Your LifeLink Password',
    preheader: 'Use the secure link to reset your LifeLink password.',
    content: `
      <p style="margin:0 0 10px; color:${BRAND.primary}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Password reset</p>
      <h1 style="margin:0 0 16px; font-size:30px; line-height:1.2;">Reset Your Password</h1>
      <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">Hello ${name},</p>
      <p style="margin:0 0 24px; font-size:16px; line-height:1.7;">
        We received a request to reset your LifeLink password. Use the secure link below to choose a new password.
      </p>
      <div style="margin:0 0 24px;">
        <a href="${link}" style="display:inline-block; padding:14px 24px; background:${BRAND.primary}; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:700;">
          Reset Password
        </a>
      </div>
      <p style="margin:0 0 8px; font-size:14px; color:${BRAND.muted};">If the button does not open, copy this link into your browser:</p>
      <p style="margin:0 0 24px; word-break:break-all; font-size:14px;">
        <a href="${link}" style="color:${BRAND.primary}; text-decoration:none;">${link}</a>
      </p>
      <div style="padding:16px 18px; background:${BRAND.accent}; border:1px solid #FECACA; border-radius:14px; font-size:14px; line-height:1.7;">
        If you did not request a password reset, you can ignore this email and your password will remain unchanged.
      </div>
    `,
  });

export const resetPasswordOtpTemplate = ({ otp, expiresInMinutes = 10, name = 'LifeLink user' }) =>
  renderShell({
    title: 'Your LifeLink Password Reset Code',
    preheader: `Your password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    content: `
      <p style="margin:0 0 10px; color:${BRAND.primary}; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Password reset only</p>
      <h1 style="margin:0 0 16px; font-size:30px; line-height:1.2;">Your Password Reset Code</h1>
      <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">Hello ${name},</p>
      <p style="margin:0 0 24px; font-size:16px; line-height:1.7;">
        Use the one-time code below to verify your password reset request in LifeLink. This code is for password reset only and cannot be used to sign in.
      </p>
      <div style="margin:0 0 20px; padding:24px; background:${BRAND.accent}; border:1px solid #FECACA; border-radius:18px; text-align:center;">
        <div style="margin:0 0 10px; font-size:13px; color:${BRAND.muted}; text-transform:uppercase; letter-spacing:0.08em;">Reset code</div>
        <div style="font-size:40px; line-height:1; font-weight:700; letter-spacing:0.28em; color:${BRAND.primary};">${otp}</div>
      </div>
      <div style="margin:0 0 20px; padding:14px 16px; border-left:4px solid ${BRAND.primary}; background:#FEF2F2; border-radius:10px;">
        <p style="margin:0; font-size:15px; color:${BRAND.primaryDark}; font-weight:700;">This code expires in ${expiresInMinutes} minutes.</p>
      </div>
      <p style="margin:0 0 18px; font-size:15px; line-height:1.7;">
        Enter this code in the password reset screen to continue. Do not share it with anyone.
      </p>
      <div style="padding:16px 18px; background:#F9FAFB; border:1px solid ${BRAND.border}; border-radius:14px; font-size:14px; line-height:1.7;">
        If you did not request a password reset, ignore this email. Your LifeLink account stays secure unless someone also has access to your email.
      </div>
    `,
  });

export default {
  confirmEmailTemplate,
  resetPasswordTemplate,
  resetPasswordOtpTemplate,
};
