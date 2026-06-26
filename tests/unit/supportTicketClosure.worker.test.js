import { describe, it, expect, beforeEach } from 'vitest';
import SupportMessage from '../../src/models/SupportMessage.model.js';
import { processUnansweredTickets } from '../../src/workers/supportTicketClosure.worker.js';
import { setupTestDB, clearDatabase } from '../helpers/db.js';

describe('Support Ticket Closure Worker', () => {
  setupTestDB();

  beforeEach(async () => {
    await clearDatabase();
  });

  const createTicket = async (overrides = {}) =>
    SupportMessage.create({
      userId: '670000000000000000000000',
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'donor',
      category: 'TECHNICAL',
      subject: 'Test ticket',
      message: 'Hello',
      status: 'REVIEWED',
      adminReply: 'We will look into it.',
      adminReplyBy: '670000000000000000000001',
      adminReplyAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
      ...overrides,
    });

  it('closes tickets older than 72 hours', async () => {
    const ticket = await createTicket();
    const result = await processUnansweredTickets();
    expect(result.closed).toBe(1);
    expect(result.failed).toBe(0);
    const updated = await SupportMessage.findById(ticket._id);
    expect(updated.status).toBe('CLOSED');
  });

  it('does not close tickets younger than 72 hours', async () => {
    await createTicket({ adminReplyAt: new Date(Date.now() - 71 * 60 * 60 * 1000) });
    const result = await processUnansweredTickets();
    expect(result.closed).toBe(0);
  });

  it('does not close OPEN tickets regardless of age', async () => {
    await createTicket({ status: 'OPEN', adminReplyAt: null, adminReply: null, adminReplyBy: null });
    const result = await processUnansweredTickets();
    expect(result.closed).toBe(0);
  });

  it('does not close already CLOSED tickets', async () => {
    await createTicket({ status: 'CLOSED' });
    const result = await processUnansweredTickets();
    expect(result.closed).toBe(0);
  });

  it('handles exact boundary at exactly 72 hours', async () => {
    await createTicket({ adminReplyAt: new Date(Date.now() - 72 * 60 * 60 * 1000) });
    const result = await processUnansweredTickets();
    expect(result.closed).toBe(1);
  });

  it('processes multiple eligible tickets', async () => {
    await createTicket({ subject: 'Ticket A' });
    await createTicket({ subject: 'Ticket B' });
    await createTicket({ subject: 'Ticket C' });
    const result = await processUnansweredTickets();
    expect(result.closed).toBe(3);
  });

  it('skips tickets with null adminReplyAt', async () => {
    await createTicket({ adminReplyAt: null });

    const result = await processUnansweredTickets();
    expect(result.closed).toBe(0);
  });
});
