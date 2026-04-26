import response from '../utils/response.js';
import HelpDocument from '../models/HelpDocument.model.js';
import SupportMessage from '../models/SupportMessage.model.js';

const FAQS = [
  { category: 'DONATION', question: 'How often can I donate blood?', answer: 'Whole blood donation is generally allowed every 56 days.' },
  { category: 'HEALTH', question: 'Can I donate if I am feeling unwell?', answer: 'No. Please wait until you are fully recovered and meet eligibility requirements.' },
  { category: 'REWARDS', question: 'How do points work?', answer: 'You earn points from successful donations, emergency responses, profile completion, and badges.' },
  { category: 'TECHNICAL', question: 'How do I reset my password?', answer: 'Use the password reset option from the login screen.' },
];

export const getFaq = async (req, res, next) => {
  try {
    return response.success(res, 200, 'FAQ retrieved successfully', { faqs: FAQS });
  } catch (error) {
    next(error);
  }
};

export const getDocument = async (req, res, next) => {
  try {
    const type = String(req.params.type || '').trim().toLowerCase();
    const doc = await HelpDocument.findOne({ type });
    if (!doc) return response.error(res, 404, 'Document not found');

    return response.success(res, 200, 'Document retrieved successfully', {
      document_url: doc.documentUrl,
      title: doc.title,
      version: doc.version,
      updated_at: doc.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

export const contactSupport = async (req, res, next) => {
  try {
    const { subject, message, attachment_urls } = req.body;
    if (!subject || !message) {
      return response.error(res, 400, 'subject and message are required');
    }

    const ticket = await SupportMessage.create({
      userId: req.user?.userId || null,
      email: req.user?.email || req.body.email || null,
      role: req.user?.role || null,
      subject,
      message,
      attachmentUrls: Array.isArray(attachment_urls) ? attachment_urls : [],
    });

    return response.success(res, 201, 'Support request submitted successfully', { ticketId: ticket._id });
  } catch (error) {
    next(error);
  }
};
