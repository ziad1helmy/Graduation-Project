import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { confirmEmailTemplate, resetPasswordOtpTemplate, resetPasswordTemplate } from './emailTemplates.js';

// ─── Transport ────────────────────────────────────────────────────────────────

function hasEmailConfig() {
  return Boolean(env.RESEND_API_KEY);
}

function isProduction() {
  return env.NODE_ENV === 'production';
}

function getResendClient() {
  if (!hasEmailConfig()) return null;
  return new Resend(env.RESEND_API_KEY);
}

function getMailFrom() {
  return env.MAIL_FROM || 'LifeLink <onboarding@resend.dev>';
}

// ─── Core send ────────────────────────────────────────────────────────────────

async function sendMail({ to, subject, text, html }) {
  const client = getResendClient();

  if (!client) {
    if (!isProduction()) {
      return {
        skipped: true,
        reason: 'RESEND_API_KEY is not configured',
        error: 'Email transport is missing required configuration',
      };
    }
    throw new Error('Email transport is not configured');
  }

  try {
    await client.emails.send({
      from: getMailFrom(),
      to,
      subject,
      text,
      html,
    });

    logger.info('Email sent', { subject, to });
    return { sent: true };

  } catch (error) {
    logger.error('Resend Email Send Error', {
      subject,
      to,
      message: error.message,
      code: error.code,
    });

    if (!isProduction()) {
      return {
        skipped: true,
        reason: 'Email send failed in development',
        error: error.message,
      };
    }

    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

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

function buildFrontendUrl(pathname, params = {}) {
  const url = new URL(pathname, env.FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
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

  if (!hasEmailConfig() && !isProduction()) {
    if (typeof onDevNoSmtp === 'function') {
      return onDevNoSmtp({ token, url });
    }
    return { skipped: true };
  }

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

async function sendVerificationOtpEmail({
  to,
  fullName,
  otp,
  subject,
  template,
  onDevNoSmtp,
}) {
  const html = template({ otp, name: fullName });
  const text = `Hello ${fullName || 'there'},\n\nUse this verification code to activate your LifeLink account: ${otp}`;

  if (!hasEmailConfig() && !isProduction()) {
    if (typeof onDevNoSmtp === 'function') {
      return onDevNoSmtp({ otp });
    }
    return { skipped: true };
  }

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

  if (!hasEmailConfig() && !isProduction()) {
    logger.debug('Password reset OTP', { email: to, otp, expiresInMinutes });
    return { skipped: true, reason: 'Resend API key not configured' };
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

export async function sendEmailVerificationEmail({ to, fullName, otp }) {
  return sendVerificationOtpEmail({
    to,
    fullName,
    subject: 'Verify your LifeLink email address',
    template: confirmEmailTemplate,
    onDevNoSmtp: ({ otp: verificationOtp }) => {
      logger.debug('Email verification code', { email: to, otp: verificationOtp });
      return { skipped: true };
    },
    otp,
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