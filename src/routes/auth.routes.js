import { Router } from 'express';
import AUC from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth - Donor
 *     description: Donor registration and authentication (signup, email verification, login)
 *   - name: Auth - Hospital
 *     description: Hospital registration and authentication (signup, email verification, login)
 *   - name: Auth
 *     description: General authentication (logout, refresh token, password reset, 2FA)
 */

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
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: [donor, hospital, admin]
 *     SignupDonorRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseUser'
 *         - type: object
 *           required: [phoneNumber, dateOfBirth, bloodType, confirmPassword]
 *           properties:
 *             phoneNumber:
 *               type: string
 *             dateOfBirth:
 *               type: string
 *               format: date
 *             bloodType:
 *               type: string
 *             confirmPassword:
 *               type: string
 *               format: password
 *     SignupHospitalRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseUser'
 *         - type: object
 *           required: [hospitalName, licenseNumber]
 *           properties:
 *             hospitalName:
 *               type: string
 *             licenseNumber:
 *               type: string
 *             phone:
 *               type: string
 *             contactNumber:
 *               type: string
 *             type:
 *               type: string
 *               example: hospital
 *     LoginRequest:
 *       type: object
 *       required: [email, password, role]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: [donor, hospital, admin]
 *     RefreshTokenRequest:
 *       type: object
 *       required: [refreshToken]
 *       properties:
 *         refreshToken:
 *           type: string
 *     EmailRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
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
 *         otp:
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
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         code:
 *           type: string
 *         message:
 *           type: string
 *     ApiSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           nullable: true
 *     ApiErrorResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/signup:
 *   post:
 *     tags: [Auth - General]
 *     summary: Register a new donor or hospital account
 *     description: Create a new account as donor or hospital. Donor signup requires phoneNumber, dateOfBirth, bloodType. Hospital signup requires hospitalName, licenseNumber
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
 *         description: User registered successfully - Email verification required
 *       '400':
 *         description: Validation or registration error
 *       '409':
 *         description: Email already registered
 *
 * /auth/login:
 *   post:
 *     tags: [Auth - Donor]
 *     summary: Donor login with email and password
 *     description: Authenticate as a donor user. Returns JWT token. Supports optional 2FA
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
 *         description: Validation error or invalid credentials
 *       '403':
 *         description: Email not verified or account suspended

 * /auth/hospital/login:
 *   post:
 *     tags: [Auth - Hospital]
 *     summary: Hospital login with email and password
 *     description: Authenticate as a hospital user. Returns JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Hospital login successful
 *       '400':
 *         description: Validation error or invalid credentials
 *       '403':
 *         description: Email not verified or hospital not approved

 * /auth/admin/login:
 *   post:
 *     tags: [Auth]
 *     summary: Admin/Superadmin login with email, password, and adminKey
 *     description: Authenticate as admin or superadmin. Requires email, password, and adminKey secret
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, adminKey]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               adminKey:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Admin login successful or 2FA verification required
 *       '400':
 *         description: Validation error or invalid credentials
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
 *     responses:
 *       '200':
 *         description: 2FA setup verified successfully
 *
 * /auth/2fa/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Complete login by verifying a 2FA code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken, code]
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
 *     responses:
 *       '200':
 *         description: 2FA disabled successfully
 */
router.post('/reset-password', AUC.resetPassword);
router.post('/signup', AUC.register);
router.post('/login', AUC.loginUser);
router.post('/hospital/login', AUC.loginHospital);
router.post('/admin/login', AUC.loginAdmin);
router.post('/logout', AUC.logout);
router.post('/refresh-token', AUC.refreshToken);
router.post('/forgot-password', AUC.forgotPassword);
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
