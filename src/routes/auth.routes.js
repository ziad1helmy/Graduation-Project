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
 *     SignupDonorRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseUser'
 *         - type: object
 *           required: [phoneNumber, dateOfBirth]
 *           properties:
 *             role:
 *               type: string
 *               enum: [donor]
 *             phoneNumber:
 *               type: string
 *             dateOfBirth:
 *               type: string
 *               format: date
 *             gender:
 *               type: string
 *               enum: [male, female, not specified]
 *             bloodType:
 *               type: string
 *               enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *             location:
 *               type: object
 *               properties:
 *                 city:
 *                   type: string
 *                 governorate:
 *                   type: string
 *     SignupHospitalRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseUser'
 *         - type: object
 *           required: [hospitalName, hospitalId, licenseNumber]
 *           properties:
 *             role:
 *               type: string
 *               enum: [hospital]
 *             hospitalName:
 *               type: string
 *             hospitalId:
 *               type: number
 *             licenseNumber:
 *               type: string
 *             address:
 *               type: object
 *               properties:
 *                 city:
 *                   type: string
 *                 governorate:
 *                   type: string
 *             contactNumber:
 *               type: string
 *             location:
 *               type: object
 *               properties:
 *                 city:
 *                   type: string
 *                 governorate:
 *                   type: string
 *     LoginRequest:
 *       type: object
 *       required: [password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         email_or_phone:
 *           type: string
 *         password:
 *           type: string
 *           format: password
 *     RefreshTokenRequest:
 *       type: object
 *       required: [refreshToken]
 *       properties:
 *         refreshToken:
 *           type: string
 *         refresh_token:
 *           type: string
 *     EmailRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         email_or_phone:
 *           type: string
 *     TokenRequest:
 *       type: object
 *       required: [token]
 *       properties:
 *         token:
 *           type: string
 *     OtpRequest:
 *       type: object
 *       required: [email, otp]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         email_or_phone:
 *           type: string
 *         otp:
 *           type: string
 *         otp_code:
 *           type: string
 *     AuthTokens:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *     FcmTokenRequest:
 *       type: object
 *       required: [fcmToken]
 *       properties:
 *         fcmToken:
 *           type: string
 *           example: fcm-device-token-from-flutter
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
 *             oneOf:
 *               - $ref: '#/components/schemas/SignupDonorRequest'
 *               - $ref: '#/components/schemas/SignupHospitalRequest'
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
 *     description: |
 *       Returns access and refresh tokens when credentials are valid and 2FA is not enabled.
 *       If 2FA is enabled, the response returns `requires2FA` and a short-lived `tempToken`
 *       instead of normal auth tokens. Compatibility aliases are also mounted under `/api/v1/auth/*`.
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
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Login successful or 2FA verification required
 *       '400':
 *         description: Invalid credentials or unverified email
 *
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (compatibility alias)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/SignupDonorRequest'
 *               - $ref: '#/components/schemas/SignupHospitalRequest'
 *     responses:
 *       '201':
 *         description: User registered successfully
 *
 * /auth/validate-token:
 *   post:
 *     tags: [Auth]
 *     summary: Validate current JWT and return session state
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Token is valid
 *
 * /auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send a password reset OTP
 *     description: |
 *       This endpoint is only used for password reset verification.
 *       It invalidates previous unused password reset OTPs for the same account
 *       and sends a password-reset-only OTP email with a 10 minute expiry.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRequest'
 *     responses:
 *       '200':
 *         description: Password reset OTP sent successfully
 *
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify password reset OTP
 *     description: |
 *       Validates the OTP and returns a short-lived `resetToken`.
 *       The returned token is only valid for `POST /auth/reset-password`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpRequest'
 *     responses:
 *       '200':
 *         description: Password reset OTP verified successfully
 *
 * /auth/2fa/setup:
 *   post:
 *     tags: [Auth]
 *     summary: Initialize 2FA setup
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 2FA setup initialized
 *
 * /auth/2fa/confirm-setup:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm 2FA setup for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *               otp:
 *                 type: string
 *               otp_code:
 *                 type: string
 *     responses:
 *       '200':
 *         description: 2FA setup verified successfully
 *
 * /auth/2fa/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Complete login by verifying a 2FA code
 *     description: |
 *       Accepts the short-lived `tempToken` returned by `/auth/login` when `requires2FA` is true.
 *       On success it returns normal auth tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken, code]
 *             properties:
 *               tempToken:
 *                 type: string
 *               temp_token:
 *                 type: string
 *               code:
 *                 type: string
 *               otp:
 *                 type: string
 *               otp_code:
 *                 type: string
 *     responses:
 *       '200':
 *         description: 2FA verified successfully
 *
 * /auth/2fa/disable:
 *   post:
 *     tags: [Auth]
 *     summary: Disable 2FA
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       '200':
 *         description: 2FA disabled successfully
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and blacklist refresh token
 *     description: |
 *       Stores a SHA-256 hash of the refresh token in blacklist storage.
 *       Blacklisted tokens are denied on subsequent refresh attempts.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRequest'
 *     responses:
 *       '200':
 *         description: Password reset request accepted
 *
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     description: |
 *       Accepts either the existing email reset link token or the short-lived `resetToken`
 *       returned by `/auth/verify-otp`. The token is password-reset-specific, not a normal auth token.
 *       Successful resets invalidate previously issued sessions via `passwordChangedAt`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               reset_token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               new_password:
 *                 type: string
 *                 format: password
 *     responses:
 *       '200':
 *         description: Password reset successful
 *
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Send email verification message
 *     description: Creates a new verification token and sends verification email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRequest'
 *     responses:
 *       '200':
 *         description: Verification email sent
 *
 * /auth/verify-email-token:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with token
 *     description: |
 *       Marks account as verified if token is valid and not expired.
 *       Browser requests receive a lightweight success or failure HTML page for demo-friendly UX.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenRequest'
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
 *
 * /auth/fcm-token:
 *   post:
 *     tags: [Auth]
 *     summary: Register the current device FCM token
 *     description: |
 *       Stores the device token for the authenticated user using a deduplicated token array.
 *       Flutter should call this on app startup or immediately after login, and again when Firebase
 *       refreshes the token. The same endpoint is also mounted under `/api/v1/auth/fcm-token`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FcmTokenRequest'
 *     responses:
 *       '200':
 *         description: FCM token registered successfully
 *       '400':
 *         description: Missing or empty token
 *       '401':
 *         description: Unauthorized
 *
 *   put:
 *     tags: [Auth]
 *     summary: Replace the stored FCM tokens with the current active device token
 *     description: |
 *       Lightweight bulk-replace helper for login/startup flows. It keeps only the provided token for
 *       the authenticated user and is also available under `/api/v1/auth/fcm-token`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FcmTokenRequest'
 *     responses:
 *       '200':
 *         description: FCM token updated successfully
 *       '400':
 *         description: Missing or empty token
 *       '401':
 *         description: Unauthorized
 *
 *   delete:
 *     tags: [Auth]
 *     summary: Remove a device FCM token
 *     description: |
 *       Removes the provided token if present. Safe to call on logout, app reinstall, or when cleaning
 *       up stale tokens. The same endpoint is also mounted under `/api/v1/auth/fcm-token`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FcmTokenRequest'
 *     responses:
 *       '200':
 *         description: FCM token removed successfully
 *       '400':
 *         description: Missing or empty token
 *       '401':
 *         description: Unauthorized
 */

router.post('/signup', AUC.register);
router.post('/register', AUC.register);
router.post('/login', AUC.login);
router.post('/logout', AUC.logout);
router.post('/refresh-token', AUC.refreshToken);
router.post('/forgot-password', AUC.forgotPassword);
router.post('/reset-password', AUC.resetPassword);
router.post('/password-reset', AUC.resetPassword);
router.post('/send-otp', AUC.sendOtp);
router.post('/verify-otp', AUC.verifyOtp);
router.post('/2fa/setup', authMiddleware, AUC.setup2FA);
router.post('/2fa/confirm-setup', authMiddleware, AUC.confirm2FASetup);
router.post('/2fa/verify', AUC.verify2FA);
router.post('/2fa/disable', authMiddleware, AUC.disable2FA);

router.get('/me', authMiddleware, AUC.getMe);
router.post('/validate-token', authMiddleware, AUC.validateToken);
router.post('/verify-email', AUC.verifyEmail);
router.post('/verify-email-token', AUC.verifyEmailToken);
router.post('/fcm-token', authMiddleware, AUC.registerFcmToken);
router.put('/fcm-token', authMiddleware, AUC.replaceFcmToken);
router.delete('/fcm-token', authMiddleware, AUC.removeFcmToken);

export default router;
