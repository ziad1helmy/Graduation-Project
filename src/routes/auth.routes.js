import { Router } from 'express';
import AUC from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     BaseUser:
 *       type: object
 *       required: [fullName, email, password, role]
 *       properties:
 *         fullName:
 *           type: string
 *           example: Sara Ali
 *         email:
 *           type: string
 *           format: email
 *           example: sara@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: SecurePass@123
 *         role:
 *           type: string
 *           enum: [donor, hospital]
 *     AuthTokens:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new donor or hospital account
 *     description: |
 *       Creates a user, returns access/refresh tokens, and triggers email verification.
 *       In non-production environments the response may include `verificationToken`
 *       for local testing and E2E automation when SMTP is not configured.
 *     parameters:
 *       - in: header
 *         name: x-test-mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Development-only header to bypass rate limiting for automated tests.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BaseUser'
 *     responses:
 *       '201':
 *         description: User registered successfully
 *       '400':
 *         description: Validation or registration error
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     description: Returns tokens only when email is verified.
 *     parameters:
 *       - in: header
 *         name: x-test-mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Development-only header to bypass rate limiting for automated tests.
 *     responses:
 *       '200':
 *         description: Login successful
 *       '400':
 *         description: Invalid credentials or unverified email
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and blacklist refresh token
 *     description: |
 *       Stores a SHA-256 hash of the refresh token in blacklist storage.
 *       Blacklisted tokens are denied on subsequent refresh attempts.
 *     responses:
 *       '200':
 *         description: Logged out successfully
 *
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Issue a new access token from refresh token
 *     description: |
 *       Rejects blacklisted tokens and tokens issued before `passwordChangedAt`.
 *     responses:
 *       '200':
 *         description: Token refreshed
 *       '400':
 *         description: Invalid, expired, blacklisted, or stale refresh token
 *
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: |
 *       Always returns success to prevent account enumeration.
 *       If account exists, reset token email is sent.
 *     responses:
 *       '200':
 *         description: Password reset request accepted
 *
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     description: |
 *       Validates reset token, updates password, clears reset token fields,
 *       and invalidates previously issued sessions via `passwordChangedAt`.
 *     responses:
 *       '200':
 *         description: Password reset successful
 *
 * /auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Send email verification message
 *     description: Creates a new verification token and sends verification email.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       '200':
 *         description: Verification email sent
 *
 * /auth/verify-email-token:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email with token
 *     description: Marks account as verified if token is valid and not expired.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Email verified successfully
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Requires a valid access token. Access tokens issued before password reset
 *       are rejected by auth middleware.
 *     responses:
 *       '200':
 *         description: User retrieved
 *       '401':
 *         description: Unauthorized
 */

router.post('/signup', AUC.register);
router.post('/login', AUC.login);
router.post('/logout', AUC.logout);
router.post('/refresh-token', AUC.refreshToken);
router.post('/forgot-password', AUC.forgotPassword);
router.post('/reset-password', AUC.resetPassword);

router.get('/me', authMiddleware, AUC.getMe);
router.get('/verify-email', AUC.verifyEmail);
router.get('/verify-email-token', AUC.verifyEmailToken);

export default router;
