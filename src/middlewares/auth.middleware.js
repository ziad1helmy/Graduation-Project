import response from '../utils/response.js';
import { verifyToken, TokenExpiredError, JsonWebTokenError } from '../utils/jwt.js';
import User from '../models/User.model.js';

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return response.error(res, 401, 'auth.error_authorization_header_required');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return response.error(res, 401, 'auth.error_authorization_bearer_format');
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select(
      'email fullName isEmailVerified role isSuspended deletedAt +passwordChangedAt'
    );

    if (!user) {
      return response.error(res, 401, 'error.unauthorized');
    }

    // Block soft-deleted accounts
    if (user.deletedAt) {
      return response.error(res, 401, 'auth.error_account_not_found');
    }

    // Block suspended accounts
    if (user.isSuspended) {
      return response.error(res, 403, 'auth.error_account_suspended');
    }

    if (user.passwordChangedAt && decoded?.iat) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      if (tokenIssuedAtMs < user.passwordChangedAt.getTime()) {
        return response.error(res, 401, 'auth.error_token_no_longer_valid');
      }
    }

    if (!user.isEmailVerified) {
      return response.error(res, 403, 'auth.error_email_not_verified');
    }

    req.user = {
      ...decoded,
      userId: user._id.toString(),
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return response.error(res, 401, 'auth.error_token_expired');
    }
    if (err instanceof JsonWebTokenError) {
      return response.error(res, 401, 'auth.error_invalid_token_generic');
    }
    return response.error(res, 401, 'error.unauthorized');
  }
}

