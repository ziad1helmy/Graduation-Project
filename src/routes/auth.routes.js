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
 *           minLength: 3
 *           maxLength: 100
 *           example: Sara Ali
 *         email:
 *           type: string
 *           format: email
 *           example: sara@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: Must contain at least one uppercase, one lowercase, one digit, and one special character
 *           example: SecurePass@123
 *         role:
 *           type: string
 *           enum: [donor, hospital]
 *           example: donor
 *
 *     DonorRegister:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseUser'
 *         - type: object
 *           required: [phoneNumber, dateOfBirth]
 *           properties:
 *             role:
 *               type: string
 *               enum: [donor]
 *               example: donor
 *             phoneNumber:
 *               type: string
 *               pattern: '^\d{10}$'
 *               description: 10-digit phone number
 *               example: '1234567890'
 *             dateOfBirth:
 *               type: string
 *               format: date
 *               description: Date of birth (YYYY-MM-DD)
 *               example: '1990-05-15'
 *             gender:
 *               type: string
 *               enum: [male, female, not specified]
 *               example: female
 *             bloodType:
 *               type: string
 *               enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *               example: O+
 *             location:
 *               type: object
 *               properties:
 *                 city:
 *                   type: string
 *                   example: Cairo
 *                 governrate:
 *                   type: string
 *                   example: Cairo
 *
 *     HospitalRegister:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseUser'
 *         - type: object
 *           required: [hospitalName, hospitalId, licenseNumber]
 *           properties:
 *             role:
 *               type: string
 *               enum: [hospital]
 *               example: hospital
 *             hospitalName:
 *               type: string
 *               minLength: 3
 *               maxLength: 200
 *               example: Cairo Medical Center
 *             hospitalId:
 *               type: number
 *               example: 12345
 *             licenseNumber:
 *               type: string
 *               minLength: 5
 *               maxLength: 50
 *               example: LIC-2024-001
 *             address:
 *               type: object
 *               properties:
 *                 city:
 *                   type: string
 *                   example: Cairo
 *                 governrate:
 *                   type: string
 *                   example: Cairo
 *             contactNumber:
 *               type: string
 *               example: '+20123456789'
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: User registered successfully
 *         data:
 *           type: object
 *           properties:
 *             accessToken:
 *               type: string
 *               example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYxMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJyb2xlIjoiZG9ub3IiLCJpYXQiOjE3MDAwMDAwMDB9.abcdef123456
 *             refreshToken:
 *               type: string
 *               example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmYxMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJyb2xlIjoiZG9ub3IiLCJpYXQiOjE3MDAwMDAwMDB9.xyz789
 *             user:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: 66f100000000000000000001
 *                 fullName:
 *                   type: string
 *                   example: Sara Ali
 *                 email:
 *                   type: string
 *                   example: sara@example.com
 *                 role:
 *                   type: string
 *                   enum: [donor, hospital]
 *                   example: donor
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Error message here
 *
 * /auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new donor or hospital account
 *     description: Register using role-specific fields. Donor requires phoneNumber and dateOfBirth. Hospital requires hospitalName, hospitalId, and licenseNumber.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/DonorRegister'
 *               - $ref: '#/components/schemas/HospitalRegister'
 *             discriminator:
 *               propertyName: role
 *               mapping:
 *                 donor: '#/components/schemas/DonorRegister'
 *                 hospital: '#/components/schemas/HospitalRegister'
 *           examples:
 *             donorExample:
 *               summary: Donor Registration
 *               value:
 *                 fullName: Sara Ali
 *                 email: sara.donor@example.com
 *                 password: SecurePass@123
 *                 role: donor
 *                 phoneNumber: '1234567890'
 *                 dateOfBirth: '1990-05-15'
 *                 gender: female
 *                 bloodType: O+
 *             hospitalExample:
 *               summary: Hospital Registration
 *               value:
 *                 fullName: Admin User
 *                 email: admin@hospital.com
 *                 password: SecurePass@123
 *                 role: hospital
 *                 hospitalName: Cairo Medical Center
 *                 hospitalId: 12345
 *                 licenseNumber: LIC-2024-001
 *     responses:
 *       '201':
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '400':
 *         description: Registration error - validation failed or email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validationError:
 *                 summary: Validation Error
 *                 value:
 *                   success: false
 *                   message: Email is required; Phone number must be 10 digits
 *               emailExists:
 *                 summary: Email Already Registered
 *                 value:
 *                   success: false
 *                   message: Email is already registered
 *
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sara@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass@123
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '400':
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout by providing a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       '200':
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '400':
 *         description: Logout error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/refresh-token:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Exchange a refresh token for a new access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       '200':
 *         description: Token refreshed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *       '400':
 *         description: Refresh error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Request a password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sara@example.com
 *     responses:
 *       '200':
 *         description: Password reset email sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '400':
 *         description: Forgot password error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset a password using a reset token
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
 *                 example: reset-token-123
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewSecure@123
 *     responses:
 *       '200':
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '400':
 *         description: Reset error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get the current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       '401':
 *         description: Missing or invalid JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/verify-email:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Send an email verification message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sara@example.com
 *     responses:
 *       '200':
 *         description: Verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '400':
 *         description: Verification error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/verify-email-token:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify an email using a verification token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 example: verify-token-123
 *     responses:
 *       '200':
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '400':
 *         description: Verification error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
