import crypto from 'node:crypto';
import response from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import InboundEmail from '../models/InboundEmail.model.js';

function verifySignature(rawBody, headerValue) {
  if (!headerValue) return false;
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured — skip verification

  try {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    // Accept header in formats: hex or prefixed like 'sha256=...'
    const header = headerValue.startsWith('sha256=') ? headerValue.slice(7) : headerValue;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(header));
  } catch (err) {
    return false;
  }
}

async function processWebhookEvent(parsed) {
  const { type, data } = parsed;

  switch (type) {
    case 'email.received': {
      const inboundEmail = new InboundEmail({
        provider: 'resend',
        providerEventId: parsed?.id || parsed?.event_id || parsed?.eventId,
        messageId: data?.message_id || data?.messageId || data?.id,
        from: data?.from || '',
        to: Array.isArray(data?.to) ? data.to : data?.to ? [data.to] : [],
        cc: Array.isArray(data?.cc) ? data.cc : data?.cc ? [data.cc] : [],
        bcc: Array.isArray(data?.bcc) ? data.bcc : data?.bcc ? [data.bcc] : [],
        subject: data?.subject || '',
        text: data?.text || data?.body || '',
        html: data?.html || '',
        headers: data?.headers || {},
        attachments: data?.attachments || [],
        rawPayload: parsed,
        receivedAt: data?.received_at || data?.receivedAt || parsed?.created_at || new Date(),
        isRead: false,
        isArchived: false,
      });

      await inboundEmail.save();
      logger.info('Inbound email stored (webhook)', {
        inboundEmailId: inboundEmail._id,
        from: inboundEmail.from,
        subject: inboundEmail.subject,
      });
      break;
    }

    case 'email.delivered':
      logger.info('Email delivered (webhook)', { to: data?.to });
      // TODO: update DB record by message id / recipient
      break;

    case 'email.bounced':
      logger.warn('Email bounced (webhook)', { to: data?.to });
      // TODO: mark user email as invalid in DB
      break;

    case 'email.complained':
      logger.warn('Spam complaint (webhook)', { to: data?.to });
      // TODO: flag/unsubscribe user
      break;

    default:
      logger.debug('Unhandled webhook type (webhook)', { type });
  }
}

export async function handleResendWebhook(req, res) {
  const raw = req.body; // express.raw set this to Buffer
  const signatureHeader = req.headers['resend-signature'] || req.headers['x-resend-signature'] || req.headers['signature'] || req.headers['x-signature'];

  if (!verifySignature(raw, String(signatureHeader || ''))) {
    logger.warn('Webhook signature verification failed', { ip: req.ip });
    return response.error(res, 401, 'Invalid signature');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    logger.warn('Malformed webhook payload', { message: err.message });
    return response.error(res, 400, 'Malformed payload');
  }

  logger.info('Resend webhook received', { type: parsed?.type, to: parsed?.data?.to });

  // Fire-and-forget processing to avoid blocking the webhook response
  setImmediate(() => {
    processWebhookEvent(parsed).catch((err) => {
      logger.error('Webhook processing error', { message: err.message });
    });
  });

  return response.success(res, 200, 'Webhook received', { received: true });
}