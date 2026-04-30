import response from '../utils/response.js';
import * as donationService from '../services/donation.service.js';

export const completeDonation = async (req, res, next) => {
  try {
    const donationId = req.body.donationId || req.query.donationId || req.params.donationId;

    if (!donationId) {
      return response.error(res, 400, 'donationId is required');
    }

    const donation = await donationService.updateDonationStatus(donationId, 'completed', {
      completedDate: req.body.completedDate,
      notes: req.body.notes,
    });

    return response.success(res, 200, 'Donation completed successfully', donation);
  } catch (error) {
    if (error.message === 'Donation not found') {
      return response.error(res, 404, error.message);
    }
    if (error.message === 'Invalid donation status') {
      return response.error(res, 400, error.message);
    }
    next(error);
  }
};