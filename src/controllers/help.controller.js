import response from '../utils/response.js';
import HelpDocument from '../models/HelpDocument.model.js';
import SupportMessage from '../models/SupportMessage.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const FAQS = [
  { category: 'DONATION', question: 'How often can I donate blood?', answer: 'Donation intervals depend on type: whole blood every 56 days, plasma every 14 days, and platelets every 7 days.' },
  { category: 'HEALTH', question: 'Can I donate if I am feeling unwell?', answer: 'No. Please wait until you are fully recovered and meet eligibility requirements.' },
  { category: 'REWARDS', question: 'How do points work?', answer: 'You earn points from successful donations, emergency responses, profile completion, and badges.' },
  { category: 'TECHNICAL', question: 'How do I reset my password?', answer: 'Use the password reset option from the login screen.' },
];

export const getFaq = asyncHandler(async (req, res) => {
  return response.success(res, 200, 'FAQ retrieved successfully', { faqs: FAQS });
});

export const getDocument = asyncHandler(async (req, res) => {
  const type = String(req.params.type || '').trim().toLowerCase();
  const doc = await HelpDocument.findOne({ type });
  if (!doc) return response.error(res, 404, 'Document not found');

  return response.success(res, 200, 'Document retrieved successfully', {
    document_url: doc.documentUrl,
    title: doc.title,
    version: doc.version,
    updated_at: doc.updatedAt,
  });
});

export const contactSupport = asyncHandler(async (req, res) => {
  if (
    req.body.email !== undefined ||
    req.body.fullName !== undefined ||
    req.body.role !== undefined ||
    req.body.userId !== undefined ||
    req.body.id !== undefined
  ) {
    return response.error(res, 400, 'Identity fields cannot be provided in the request body');
  }

  const { subject, category, message } = req.body;
  if (!subject || !category || !message) {
    return response.error(res, 400, 'subject, category, and message are required');
  }

  const allowedCategories = ['TECHNICAL', 'ACCOUNT', 'DONATION', 'REWARDS', 'OTHER'];
  if (!allowedCategories.includes(category)) {
    return response.error(res, 400, `category must be one of: ${allowedCategories.join(', ')}`);
  }

  const user = req.user;
  if (!user) {
    return response.error(res, 401, 'Unauthorized');
  }

  const ticket = await SupportMessage.create({
    userId: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    subject,
    category,
    message,
  });

  return response.success(res, 201, 'Support request submitted successfully', {
    ticket: {
      id: ticket._id,
      fullName: ticket.fullName,
      email: ticket.email,
      role: ticket.role,
      subject: ticket.subject,
      category: ticket.category,
      message: ticket.message,
      createdAt: ticket.createdAt,
    },
  });
});
