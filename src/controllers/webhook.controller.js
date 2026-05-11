import { logger } from '../utils/logger.js';

export async function handleResendWebhook(req, res) {
  const { type, data } = req.body;

  logger.info('Resend webhook received', { type, to: data?.to });

  switch (type) {
    case 'email.delivered':
      logger.info('Email delivered', { to: data.to });
      // e.g. update DB record
      break;

    case 'email.bounced':
      logger.warn('Email bounced', { to: data.to });
      // e.g. mark user email as invalid
      break;

    case 'email.complained':
      logger.warn('Spam complaint', { to: data.to });
      // e.g. unsubscribe user
      break;

    default:
      logger.debug('Unhandled webhook type', { type });
  }

  res.status(200).json({ received: true });
}