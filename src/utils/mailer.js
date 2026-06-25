import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import {
  confirmEmailTemplate,
  emailVerifiedTemplate,
  passwordChangedTemplate,
  resetPasswordOtpTemplate,
  resetPasswordTemplate,
  supportReplyTemplate,
} from './emailTemplates.js';

// ─── Transport ────────────────────────────────────────────────────────────────

function hasEmailConfig() {
  return Boolean(env.RESEND_API_KEY);
}

function isProduction() {
  return env.NODE_ENV === 'production';
}

let _resendClient = null;
function getResendClient() {
  if (!hasEmailConfig()) return null;
  if (!_resendClient) _resendClient = new Resend(env.RESEND_API_KEY);
  return _resendClient;
}

function getMailFrom() {
  return env.MAIL_FROM || 'LifeLink <onboarding@resend.dev>';
}

function getRecipient(to) {
  // In development, redirect all emails to DEV_MAIL_TO if set
  if (!isProduction() && env.DEV_MAIL_TO) {
    return env.DEV_MAIL_TO;
  }
  return to;
}

function getSubject(subject) {
  // Prefix subject with [DEV] in development for clarity
  return !isProduction() ? `[DEV] ${subject}` : subject;
}

// ─── Core send ────────────────────────────────────────────────────────────────

/**
 * Send a raw email.
 * @param {{ to: string|string[], subject: string, text?: string, html?: string }} options
 * @returns {Promise<{ sent: true } | { skipped: true, reason: string, error?: string }>}
 */
async function sendMail({ to, subject, text, html }) {
  const client = getResendClient();

  if (!client) {
    if (!isProduction()) {
      logger.warn('Email skipped — RESEND_API_KEY not configured', { subject, to });
      return {
        skipped: true,
        reason: 'RESEND_API_KEY is not configured',
        error: 'Email transport is missing required configuration',
      };
    }
    throw new Error('Email transport is not configured');
  }

  const recipient = getRecipient(to);
  const finalSubject = getSubject(subject);

  try {
    const { data, error } = await client.emails.send({
      from: getMailFrom(),
      to: recipient,
      subject: finalSubject,
      text,
      html,
    });

    if (error) {
      throw Object.assign(new Error(error.message), { code: error.name });
    }

    logger.info('Email sent', { subject: finalSubject, to: recipient, id: data?.id });
    return { sent: true, id: data?.id };

  } catch (error) {
    logger.error('Resend Email Send Error', {
      subject: finalSubject,
      to: recipient,
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
  return { sent: true, ...(result?.id ? { id: result.id } : {}) };
}

function buildFrontendUrl(pathname, params = {}) {
  const base = env.FRONTEND_URL?.replace(/\/$/, '');
  if (!base) throw new Error('FRONTEND_URL is not configured');
  const url = new URL(pathname, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function createTokenText({ fullName, actionLabel, url, token }) {
  const safeName = fullName || 'there';
  return [
    `Hello ${safeName},`,
    '',
    `Use the following link to ${actionLabel}:`,
    url,
    '',
    `Token: ${token}`,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
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
  const text = [
    `Hello ${fullName || 'there'},`,
    '',
    `Use this verification code to activate your LifeLink account: ${otp}`,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

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

/**
 * Send a password reset link email.
 */
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

/**
 * Send a password reset OTP code email.
 */
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

  const html = resetPasswordOtpTemplate({
    otp,
    expiresInMinutes,
    name: fullName || 'LifeLink user',
  });

  if (!hasEmailConfig() && !isProduction()) {
    logger.debug('Password reset OTP (dev)', { email: to, otp, expiresInMinutes });
    return { skipped: true, reason: 'Resend API key not configured' };
  }

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

/**
 * Send a confirmation email after password was changed.
 */
export async function sendPasswordResetConfirmationEmail({ to, fullName }) {
  const subject = 'Your LifeLink password was changed';
  const text = [
    `Hello ${fullName || 'there'},`,
    '',
    'Your password was changed successfully.',
    'If you did not do this, please contact support immediately.',
  ].join('\n');

  const html = passwordChangedTemplate({ name: fullName || 'LifeLink user' });

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

/**
 * Send an email verification OTP to a new user.
 */
export async function sendEmailVerificationEmail({ to, fullName, otp }) {
  return sendVerificationOtpEmail({
    to,
    fullName,
    otp,
    subject: 'Verify your LifeLink email address',
    template: confirmEmailTemplate,
    onDevNoSmtp: ({ otp: verificationOtp }) => {
      logger.debug('Email verification OTP (dev)', { email: to, otp: verificationOtp });
      return { skipped: true };
    },
  });
}

/**
 * Send a confirmation email after email was verified.
 */
export async function sendEmailVerificationConfirmationEmail({ to, fullName }) {
  const subject = 'Your LifeLink email is verified';
  const text = [
    `Hello ${fullName || 'there'},`,
    '',
    'Your email address has been verified successfully.',
    'Welcome to LifeLink!',
  ].join('\n');

  const html = emailVerifiedTemplate({ name: fullName || 'LifeLink user' });

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

/**
 * Send a welcome email to a newly registered user.
 */
export async function sendWelcomeEmail({ to, fullName }) {
  const subject = 'Welcome to LifeLink!';
  const text = [
    `Hello ${fullName || 'there'},`,
    '',
    "Welcome to LifeLink! We're glad to have you.",
    'Your account is ready to use.',
    '',
    'If you have any questions, feel free to reach out to our support team.',
  ].join('\n');

  const html = `
    <p>Hello ${fullName || 'there'},</p>
    <p>Welcome to <strong>LifeLink</strong>! We're glad to have you. 🎉</p>
    <p>Your account is ready to use.</p>
    <p>If you have any questions, feel free to reach out to our support team.</p>
  `;

  const result = await sendMail({ to, subject, text, html });
  return normalizeMailResult(result);
}

/**
 * Send a support-reply notification email to the user who submitted the ticket.
 * @param {{ to: string, fullName: string, subject: string, originalMessage: string, reply: string }} options
 */
export async function sendSupportReplyEmail({ to, fullName, subject, originalMessage, reply }) {
  const emailSubject = `Re: ${subject} — LifeLink Support`;
  const html = supportReplyTemplate({ name: fullName, subject, originalMessage, reply });
  const text = [
    `Hello ${fullName || 'there'},`,
    '',
    `Our support team has replied to your request: ${subject}`,
    '',
    'Their response:',
    reply,
    '',
    'Your original message:',
    originalMessage,
    '',
    'If you need further assistance, submit a new request in the LifeLink app.',
  ].join('\n');

  const result = await sendMail({ to, subject: emailSubject, text, html });
  return normalizeMailResult(result);
}

export default {
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendPasswordResetConfirmationEmail,
  sendEmailVerificationEmail,
  sendEmailVerificationConfirmationEmail,
  sendWelcomeEmail,
  sendSupportReplyEmail,
};