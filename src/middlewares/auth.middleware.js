import response from '../utils/response.js';
import { verifyToken, TokenExpiredError, JsonWebTokenError } from '../utils/jwt.js';
import User from '../models/User.model.js';

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return response.error(res, 401, 'Authorization header is required');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return response.error(res, 401, 'Authorization header must be: Bearer <token>');
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select(
      'email fullName isEmailVerified role isSuspended deletedAt +passwordChangedAt'
    );

    if (!user) {
      return response.error(res, 401, 'Unauthorized');
    }

    // Block soft-deleted accounts
    if (user.deletedAt) {
      return response.error(res, 401, 'Account not found');
    }

    // Block suspended accounts
    if (user.isSuspended) {
      return response.error(res, 403, 'Account is suspended');
    }

    if (user.passwordChangedAt && decoded?.iat) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      if (tokenIssuedAtMs < user.passwordChangedAt.getTime()) {
        return response.error(res, 401, 'Token is no longer valid. Please log in again');
      }
    }

    if (!user.isEmailVerified) {
      return response.error(res, 403, 'Email address is not verified');
    }

    req.user = {
      ...decoded,
      userId: user._id.toString(),
      _id: user._id,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return response.error(res, 401, 'Token has expired');
    }
    if (err instanceof JsonWebTokenError) {
      return response.error(res, 401, 'Invalid token');
    }
    return response.error(res, 401, 'Unauthorized');
  }
}

