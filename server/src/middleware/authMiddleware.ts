// Verifies JWT tokens and attaches user data to requests for protected routes.
import jwt from 'jsonwebtoken'; //install jsonwebtoken; install types
import { Request, Response, NextFunction, RequestHandler } from 'express';

console.log('Loading authMiddleware.ts');

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

export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log request details for debugging
  console.log('🔍 requireAuth middleware called:', {
    path: req.path,
    originalUrl: req.originalUrl,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    hasCookie: !!req.cookies.token,
  });

  // Try to get JWT token from Authorization header first (for Safari compatibility)
  // Fallback to cookie if header not present
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies.token;

  // For /orgs endpoint, we're using GitHub token, not JWT
  // So we need to be more lenient - let the route handler check for GitHub token
  const isOrgsEndpoint =
    req.path.includes('/orgs') || req.originalUrl.includes('/orgs');

  if (!token) {
    // Special case: if this is the /orgs endpoint, allow it through
    // The route handler will check for GitHub token in Authorization header
    if (isOrgsEndpoint) {
      console.log(
        '⚠️ requireAuth: No JWT token, but allowing /orgs through to check GitHub token',
        {
          path: req.path,
          originalUrl: req.originalUrl,
        }
      );
      next();
      return;
    }
    console.error('❌ requireAuth: No token found and not /orgs endpoint');
    res.status(401).json({ message: 'Missing auth token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    console.log(
      '✅ requireAuth: JWT verified from',
      authHeader ? 'Authorization header' : 'cookie'
    );

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (err) {
    // If JWT verification fails but this is /orgs, allow through
    // The route handler will check for GitHub token
    if (isOrgsEndpoint) {
      console.log(
        '⚠️ requireAuth: JWT verification failed, but allowing /orgs through to check GitHub token',
        {
          path: req.path,
          originalUrl: req.originalUrl,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      );
      next();
      return;
    }
    console.error('❌ requireAuth: JWT verification failed:', err);
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};
