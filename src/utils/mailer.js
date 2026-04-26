import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { confirmEmailTemplate, resetPasswordOtpTemplate, resetPasswordTemplate } from './emailTemplates.js';

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function createTransporter() {
  if (!hasSmtpConfig()) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function buildFrontendUrl(pathname, params = {}) {
  const url = new URL(pathname, env.FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function isProduction() {
  return env.NODE_ENV === 'production';
}

function normalizeMailResult(result) {
  if (result?.skipped) {
    return {
      skipped: true,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
  }

  return { sent: true };
}

function createTokenText({ fullName, actionLabel, url, token }) {
  const safeName = fullName || 'there';
  return `Hello ${safeName},\n\nUse the following link to ${actionLabel}: ${url}\n\nToken: ${token}`;
}

async function sendTokenEmail({
  to,
  fullName,
  token,
  subject,
  pathname,
  actionLabel,
  template,
  onDevNoSmtp,
}) {
  const url = buildFrontendUrl(pathname, { token });
  const html = template(url, fullName);
  const text = createTokenText({ fullName, actionLabel, url, token });

  if (!hasSmtpConfig() && !isProduction()) {
    if (typeof onDevNoSmtp === 'function') {
      return onDevNoSmtp({ token, url });
    }

    return { skipped: true };
  }

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();

  if (!transporter) {
    if (env.NODE_ENV !== 'production') {
      return {
        skipped: true,
        reason: 'SMTP is not configured',
        error: 'SMTP transport is missing required configuration',
      };
    }

    throw new Error('Email transport is not configured');
  }

  const from = env.MAIL_FROM || env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log(`[Mail] Sent "${subject}" to ${to}`);

    return { sent: true };
  } catch (error) {
    if (!isProduction()) {
      console.warn(`[Mail] Unable to send "${subject}" to ${to}: ${error.message}`);
      return {
        skipped: true,
        reason: 'SMTP send failed in development',
        error: error.message,
      };
    }

    throw new Error('Failed to send email');
  }
}

export async function sendPasswordResetEmail({ to, fullName, token }) {
  return sendTokenEmail({
    to,
    fullName,
    token,
    subject: 'Reset your LifeLink password',
    pathname: '/reset-password',
    actionLabel: 'reset your password',
    template: resetPasswordTemplate,
  });
}

export async function sendPasswordResetOtpEmail({ to, fullName, otp, expiresInMinutes = 10 }) {
  const subject = 'Your LifeLink password reset code';
  const text = [
    `Hello ${fullName || 'there'},`,
    '',
    'Your Password Reset Code',
    `${otp}`,
    '',
    `This code expires in ${expiresInMinutes} minutes.`,
    'Use it only to reset your password in LifeLink.',
    'It cannot be used to sign in.',
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');
  const html = resetPasswordOtpTemplate({ otp, expiresInMinutes, name: fullName || 'LifeLink user' });

  if (!hasSmtpConfig() && !isProduction()) {
    console.log(`[LifeLink][Password Reset OTP Email] ${to}: ${otp} (expires in ${expiresInMinutes} minutes)`);
    return { skipped: true, reason: 'SMTP is not configured' };
  }

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

export async function sendPasswordResetConfirmationEmail({ to, fullName }) {
  const subject = 'Your LifeLink password was changed';
  const text = `Hello ${fullName || 'there'},\n\nYour password was changed successfully. If you did not do this, please contact support immediately.`;
  const html = `
    <p>Hello ${fullName || 'there'},</p>
    <p>Your password was changed successfully.</p>
    <p>If you did not do this, please contact support immediately.</p>
  `;

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

export async function sendEmailVerificationEmail({ to, fullName, token }) {
  return sendTokenEmail({
    to,
    fullName,
    token,
    subject: 'Verify your LifeLink email address',
    pathname: '/verify-email',
    actionLabel: 'verify your email address',
    template: confirmEmailTemplate,
    onDevNoSmtp: ({ token: verificationToken, url: verificationUrl }) => {
      // Development-only visibility for local testing when SMTP is not configured.
      console.log(`[LifeLink][Verification Email] token for ${to}: ${verificationToken}`);
      console.log(`[LifeLink][Verification Email] url for ${to}: ${verificationUrl}`);

      return { skipped: true };
    },
  });
}

export async function sendEmailVerificationConfirmationEmail({ to, fullName }) {
  const subject = 'Your LifeLink email is verified';
  const text = `Hello ${fullName || 'there'},\n\nYour email address has been verified successfully.`;
  const html = `
    <p>Hello ${fullName || 'there'},</p>
    <p>Your email address has been verified successfully.</p>
  `;

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

export default {
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendPasswordResetConfirmationEmail,
  sendEmailVerificationEmail,
  sendEmailVerificationConfirmationEmail,
};
