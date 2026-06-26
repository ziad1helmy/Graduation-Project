import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as helpController from '../../src/controllers/help.controller.js';
import HelpDocument from '../../src/models/HelpDocument.model.js';
import SupportMessage from '../../src/models/SupportMessage.model.js';
import { makeMockReq, makeMockRes } from '../helpers/mocks.js';

vi.mock('../../src/models/HelpDocument.model.js', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../src/models/SupportMessage.model.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

describe('Help Controller', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFaq', () => {
    it('should return all FAQs with 200 status', async () => {
      const req = makeMockReq();
      const res = makeMockRes();
      const next = vi.fn();

      await helpController.getFaq(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.faqs).toBeDefined();
      expect(callArgs.data.faqs.length).toBeGreaterThan(0);
    });
  });

  describe('getDocument', () => {
    it('should return 200 and details when document is found', async () => {
      const req = makeMockReq({ params: { type: 'terms' } });
      const res = makeMockRes();
      const next = vi.fn();

      const mockDoc = {
        documentUrl: 'https://test.com/terms.pdf',
        title: 'Terms of Service',
        version: '1.0',
        updatedAt: new Date(),
      };
      HelpDocument.findOne.mockResolvedValue(mockDoc);

      await helpController.getDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.document_url).toBe(mockDoc.documentUrl);
      expect(callArgs.data.title).toBe(mockDoc.title);
    });

    it('should return 404 when document is not found', async () => {
      const req = makeMockReq({ params: { type: 'nonexistent' } });
      const res = makeMockRes();
      const next = vi.fn();

      HelpDocument.findOne.mockResolvedValue(null);

      await helpController.getDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.message).toBe('help.error_document_not_found');
    });
  });

  describe('contactSupport', () => {
    it('should return 201 and create a ticket when subject, category, and message are provided', async () => {
      const req = makeMockReq({
        body: { subject: 'Test Subject', category: 'TECHNICAL', message: 'Test message body' },
        user: { _id: '123', userId: '123', fullName: 'Test User', email: 'test@user.com', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockTicket = {
        _id: 'ticket123',
        fullName: 'Test User',
        email: 'test@user.com',
        role: 'donor',
        subject: 'Test Subject',
        category: 'TECHNICAL',
        message: 'Test message body',
        createdAt: new Date('2026-05-24T16:24:00.000Z'),
      };
      SupportMessage.create.mockResolvedValue(mockTicket);

      await helpController.contactSupport(req, res, next);

      expect(SupportMessage.create).toHaveBeenCalledWith({
        userId: '123',
        fullName: 'Test User',
        email: 'test@user.com',
        role: 'donor',
        subject: 'Test Subject',
        category: 'TECHNICAL',
        message: 'Test message body',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.ticket).toBeDefined();
      expect(callArgs.data.ticket.id).toBe(mockTicket._id);
      expect(callArgs.data.ticket.fullName).toBe('Test User');
    });

    it('should return 400 when subject, category, or message is missing', async () => {
      const req = makeMockReq({
        body: { subject: 'Test Subject', category: 'TECHNICAL' }, // message is missing
      });
      const res = makeMockRes();
      const next = vi.fn();

      await helpController.contactSupport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.message).toBe('help.error_subject_category_message_required');
    });

    it('should return 400 when category is invalid', async () => {
      const req = makeMockReq({
        body: { subject: 'Test Subject', category: 'INVALID_CAT', message: 'Test message body' },
        user: { _id: '123', userId: '123', fullName: 'Test User', email: 'test@user.com', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await helpController.contactSupport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.message).toContain('category must be one of');
    });

    it('should return 400 and reject when identity payload fields are sent in the body', async () => {
      const req = makeMockReq({
        body: { subject: 'Test Subject', category: 'TECHNICAL', message: 'Test message body', email: 'spoofed@attacker.com' },
        user: { _id: '123', userId: '123', fullName: 'Test User', email: 'test@user.com', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      await helpController.contactSupport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.message).toBe('help.error_identity_fields');
    });
  });
});
