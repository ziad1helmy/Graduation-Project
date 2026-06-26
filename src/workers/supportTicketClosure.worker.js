import SupportMessage from '../models/SupportMessage.model.js';
import { logger } from '../utils/logger.js';

const CLOSURE_AFTER_MS = 72 * 60 * 60 * 1000;

export const processUnansweredTickets = async () => {
  const cutoff = new Date(Date.now() - CLOSURE_AFTER_MS);

  let closed = 0;
  let failed = 0;
  const MAX_ITERATIONS = 1000;
  let iterations = 0;

  let hasMore = true;
  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations += 1;
    try {
      const ticket = await SupportMessage.findOneAndUpdate(
        { status: 'REVIEWED', adminReplyAt: { $ne: null, $lte: cutoff } },
        { $set: { status: 'CLOSED' } }
      );
      if (ticket) {
        closed += 1;
        logger.info('Support ticket auto-closed after 72h', {
          ticketId: String(ticket._id),
          adminReplyAt: ticket.adminReplyAt,
        });
      } else {
        hasMore = false;
      }
    } catch (err) {
      logger.error('Failed to auto-close support ticket', { error: err.stack });
      failed += 1;
    }
  }

  return { closed, failed };
};

export default { processUnansweredTickets };
