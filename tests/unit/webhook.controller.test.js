import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import * as webhookController from '../../src/controllers/webhook.controller.js';
import InboundEmail from '../../src/models/InboundEmail.model.js';
import { env } from '../../src/config/env.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';
import { HttpError } from '../../src/utils/HttpError.js';

// Mock InboundEmail model
vi.mock('../../src/models/InboundEmail.model.js', () => {
  const saveSpy = vi.fn().mockResolvedValue({});
  function MockInboundEmail(data) {
    Object.assign(this, data, {
      _id: 'mock_inbound_email_id',
      save: saveSpy,
    });
  }
  MockInboundEmail.saveSpy = saveSpy;
  return {
    default: MockInboundEmail,
  };
});

const expectHttpError = (next, statusCode, messagePattern) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(HttpError);
  expect(err.statusCode).toBe(statusCode);
  if (messagePattern) expect(err.message).toMatch(messagePattern);
};

describe('Webhook Controller', () => {
  const secret = 'test_webhook_secret';

  beforeEach(() => {
    vi.restoreAllMocks();
    // Configure env secret
    env.RESEND_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    env.RESEND_WEBHOOK_SECRET = undefined;
  });

  describe('handleResendWebhook — Signature Verification', () => {
    it('returns 401 if signature header is missing', async () => {
      const req = makeMockReq({
        body: Buffer.from(JSON.stringify({ type: 'email.received', data: {} })),
        headers: {},
      });
      const res = makeMockRes();
      const next = vi.fn();

      await webhookController.handleResendWebhook(req, res, next);

      expectHttpError(next, 401, /Invalid signature/);
    });

    it('returns 401 if signature is invalid', async () => {
      const rawBody = Buffer.from(JSON.stringify({ type: 'email.received', data: {} }));
      const req = makeMockReq({
        body: rawBody,
        headers: { 'resend-signature': 'invalid_signature_hex' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await webhookController.handleResendWebhook(req, res, next);

      expectHttpError(next, 401);
    });

    it('proceeds and returns 200 if signature is valid (prefixed with sha256=)', async () => {
      const payload = { type: 'email.delivered', data: { to: 'test@to.com' } };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      const req = makeMockReq({
        body: rawBody,
        headers: { 'resend-signature': `sha256=${computed}` },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await webhookController.handleResendWebhook(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual({ received: true });
    });

    it('skips verification if RESEND_WEBHOOK_SECRET is not configured', async () => {
      env.RESEND_WEBHOOK_SECRET = '';
      const rawBody = Buffer.from(JSON.stringify({ type: 'email.delivered' }));
      const req = makeMockReq({
        body: rawBody,
        headers: { 'resend-signature': 'dummy' }, // header present, but secret is empty
      });
      const res = makeMockRes();
      const next = vi.fn();

      await webhookController.handleResendWebhook(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleResendWebhook — Payload Parsing & Processing', () => {
    it('returns 400 if payload cannot be parsed as JSON', async () => {
      const req = makeMockReq({
        body: Buffer.from('{ invalid json '),
        headers: { 'resend-signature': 'anything_goes_since_we_bypass' },
      });
      env.RESEND_WEBHOOK_SECRET = ''; // Bypass signature check
      const res = makeMockRes();
      const next = vi.fn();

      await webhookController.handleResendWebhook(req, res, next);

      expectHttpError(next, 400, /Malformed payload/);
    });

    it('processes email.received event and saves InboundEmail record', async () => {
      env.RESEND_WEBHOOK_SECRET = ''; // Bypass signature
      const payload = {
        type: 'email.received',
        id: 'evt_123',
        created_at: '2026-05-09T12:00:00.000Z',
        data: {
          message_id: 'msg_456',
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Hello World',
          text: 'Body content',
        },
      };
      const req = makeMockReq({
        body: Buffer.from(JSON.stringify(payload)),
        headers: { 'resend-signature': 'dummy' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      // Reset saveSpy before call
      InboundEmail.saveSpy.mockClear();

      await webhookController.handleResendWebhook(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);

      // Wait for setImmediate to execute fire-and-forget processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(InboundEmail.saveSpy).toHaveBeenCalled();
    });
  });
});
