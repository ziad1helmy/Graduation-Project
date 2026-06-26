import response from '../utils/response.js';
import HelpDocument from '../models/HelpDocument.model.js';
import SupportMessage from '../models/SupportMessage.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { isValidObjectId } from '../utils/query.js';
const FAQS = [
  { category: 'DONATION', question: 'How often can I donate blood?', answer: 'Donation intervals depend on type: whole blood every 56 days, plasma every 14 days, and platelets every 7 days.' },
  { category: 'HEALTH', question: 'Can I donate if I am feeling unwell?', answer: 'No. Please wait until you are fully recovered and meet eligibility requirements.' },
  { category: 'REWARDS', question: 'How do points work?', answer: 'You earn points from successful donations, emergency responses, profile completion, and badges.' },
  { category: 'TECHNICAL', question: 'How do I reset my password?', answer: 'Use the password reset option from the login screen.' },
];

export const getFaq = asyncHandler(async (req, res) => {
  return response.success(res, 200, 'help.faq_retrieved', { faqs: FAQS });
});

export const getDocument = asyncHandler(async (req, res) => {
  const type = String(req.params.type || '').trim().toLowerCase();
  const doc = await HelpDocument.findOne({ type });
  if (!doc) return response.error(res, 404, 'help.error_document_not_found');

  return response.success(res, 200, 'help.document_retrieved', {
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
    return response.error(res, 400, 'help.error_identity_fields');
  }

  const { subject, category, message } = req.body;
  if (!subject || !category || !message) {
    return response.error(res, 400, 'help.error_subject_category_message_required');
  }

  const allowedCategories = ['TECHNICAL', 'ACCOUNT', 'DONATION', 'REWARDS', 'OTHER'];
  if (!allowedCategories.includes(category)) {
    return response.error(res, 400, `category must be one of: ${allowedCategories.join(', ')}`);
  }

  const user = req.user;
  if (!user) {
    return response.error(res, 401, 'error.unauthorized');
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

  return response.success(res, 201, 'help.support_submitted', {
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

const toSupportMessageResponse = (ticket) => {
  if (!ticket) return null;
  return {
    _id: ticket._id,
    id: ticket._id,
    subject: ticket.subject,
    category: ticket.category,
    message: ticket.message,
    status: ticket.status,
    adminReply: ticket.adminReply,
    adminReplyAt: ticket.adminReplyAt,
    createdAt: ticket.createdAt,
  };
};

export const getMyTickets = asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const { offset, limit, page } = parsePagination(req.query, 20);

  const query = { userId: req.user._id };
  if (status) query.status = status;
  if (category) query.category = category;

  const [tickets, total] = await Promise.all([
    SupportMessage.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    SupportMessage.countDocuments(query),
  ]);

  return response.success(res, 200, 'help.support_tickets_retrieved', {
    tickets: tickets.map(toSupportMessageResponse),
    pagination: paginationMeta(total, page, limit),
  });
});

export const getMyTicketById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return response.error(res, 400, 'help.error_invalid_ticket_id');
  }

  const ticket = await SupportMessage.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!ticket) {
    return response.error(res, 404, 'help.error_support_ticket_not_found');
  }

  return response.success(res, 200, 'help.support_ticket_retrieved', {
    ticket: toSupportMessageResponse(ticket),
  });
});
