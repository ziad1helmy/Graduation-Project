import Appointment from '../models/Appointment.model.js';
import { asyncHandler } from './asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const BOOKING_LIMIT = 3;
const CANCELLATION_LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export const limitDonorBookings = asyncHandler(async (req, res, next) => {
  const donorId = req.user?.userId || req.user?._id;
  if (!donorId) return next();

  const since = new Date(Date.now() - WINDOW_MS);
  const count = await Appointment.countDocuments({
    donorId,
    createdAt: { $gte: since },
    status: { $in: ['pending', 'confirmed', 'scheduled'] },
  });

  if (count >= BOOKING_LIMIT) {
    throw new HttpError(429, `You can only book ${BOOKING_LIMIT} appointments per day`);
  }

  next();
});

export const limitDonorCancellations = asyncHandler(async (req, res, next) => {
  const donorId = req.user?.userId || req.user?._id;
  if (!donorId) return next();

  const since = new Date(Date.now() - WINDOW_MS);
  const count = await Appointment.countDocuments({
    donorId,
    status: 'cancelled',
    updatedAt: { $gte: since },
  });

  if (count >= CANCELLATION_LIMIT) {
    throw new HttpError(429, `You can only cancel ${CANCELLATION_LIMIT} appointments per day`);
  }

  next();
});
