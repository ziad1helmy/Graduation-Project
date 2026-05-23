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
      expect(callArgs.message).toBe('Document not found');
    });
  });

  describe('contactSupport', () => {
    it('should return 201 and create a ticket when subject and message are provided', async () => {
      const req = makeMockReq({
        body: { subject: 'Test Subject', message: 'Test message body' },
        user: { userId: '123', email: 'test@user.com', role: 'donor' },
      });
      const res = makeMockRes();
      const next = vi.fn();

      const mockTicket = { _id: 'ticket123' };
      SupportMessage.create.mockResolvedValue(mockTicket);

      await helpController.contactSupport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.data.ticketId).toBe(mockTicket._id);
    });

    it('should return 400 when subject or message is missing', async () => {
      const req = makeMockReq({
        body: { subject: 'Test Subject' }, // message is missing
      });
      const res = makeMockRes();
      const next = vi.fn();

      await helpController.contactSupport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.message).toBe('subject and message are required');
    });
  });
});
