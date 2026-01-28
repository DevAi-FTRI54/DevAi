/**
 * Authentication Middleware
 *
 * This middleware verifies JWT tokens and attaches user data to requests for protected routes.
 * It's like a security guard checking IDs at the door - if you have a valid token, you get in;
 * if not, you're politely asked to authenticate first.
 */
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { JWT_SECRET } from '../config/env.validation.js';
import { logger } from '../utils/logger.js';

logger.debug('Loading authMiddleware.ts');

//Local Dev Testing, not meant for online app use

// export const requireAuth = (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   const token = req.cookies.token;

//   if (token === 'admin') {
//     return next();
//   }

//   return res.status(401).json({ message: 'Unauthorized' });
// };

//Real Code for JWT
interface AuthenticatedRequest extends Request {
  user: jwt.JwtPayload | string;
}

/**
 * This middleware is like a friendly bouncer at a club - it checks if you have a valid ticket (JWT token)
 * before letting you into protected routes. But unlike a real bouncer, we're nice about it and give
 * you helpful feedback if something's wrong!
 *
 * We're flexible about where the token comes from - we check the Authorization header first (which
 * works great with Safari and modern browsers), but we'll also accept it from cookies as a fallback.
 * This dual approach helps us work smoothly across different browsers and scenarios.
 */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Safari can be a bit particular about cookies in cross-origin requests, so we check the
  // Authorization header first. This is the modern, recommended way to send tokens anyway,
  // and it works consistently across all browsers. If we find it there, great! If not,
  // we'll check cookies as a backup - it's like having two ways to prove your identity.
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Found it in the header! This is the preferred method, especially for Safari compatibility.
    // We extract just the token part (everything after "Bearer ")
    token = authHeader.substring(7);
    logger.debug('🔑 Using JWT from Authorization header');
  } else {
    // No header? No problem! Let's check cookies as a fallback. This helps with browsers
    // that handle cookies well and provides a smooth experience for users.
    token = req.cookies.token;
    if (token) {
      logger.debug('🍪 Using JWT from cookie');
    }
  }

  // If we couldn't find a token anywhere, we need to let the user know they need to authenticate.
  // We're polite about it - just a friendly "hey, you need to log in first" message.
  if (!token) {
    logger.warn('❌ No JWT token found in header or cookie', {
      url: req.originalUrl,
      ip: req.ip,
    });
    res.status(401).json({ message: 'Missing auth token' });
    return;
  }

  // Now let's verify the token is valid. JWT verification checks both the signature (to make sure
  // it wasn't tampered with) and the expiration (to make sure it's still fresh). If everything
  // checks out, we attach the decoded user info to the request so downstream handlers can use it.
  try {
    // Verify the token using our validated JWT secret
    // The secret comes from our validated environment configuration, so we know it's
    // present and at least 32 characters (for security) before we try to use it
    const decoded = jwt.verify(token, JWT_SECRET);
    logger.debug('✅ JWT validated', {
      user: (decoded as any).githubUsername || 'unknown',
      url: req.originalUrl,
    });

    // Attach the decoded user info to the request - this is like giving the user a name tag
    // so other parts of the app know who they are!
    (req as AuthenticatedRequest).user = decoded;
    next(); // All good! Let them through to the protected route.
  } catch (err: any) {
    logger.warn('❌ JWT validation failed:', {
      error: err.message,
      errorName: err.name,
      url: req.originalUrl,
      ip: req.ip,
    });
    // If the token expired, we want to be helpful and tell the user when it expired.
    // This gives them context about why they need to log in again - it's not a bug,
    // it's just time for a fresh token!
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        message: 'Token expired',
        expiredAt: err.expiredAt, // Include when it expired so the frontend can show a helpful message
      });
    } else {
      // For other errors (invalid signature, malformed token, etc.), we give a general message.
      // We don't want to leak too much detail about what went wrong for security reasons.
      res.status(403).json({ message: 'Invalid or expired token' });
    }
  }
};
