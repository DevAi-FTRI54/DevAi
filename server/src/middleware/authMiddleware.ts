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
  // Check Authorization header first (Safari compatibility)
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('🔑 Using JWT from Authorization header');
  } else {
    // Fallback to cookie
    token = req.cookies.token;
    if (token) {
      console.log('🍪 Using JWT from cookie');
    }
  }
  
  if (!token) {
    console.log('❌ No JWT token found in header or cookie');
    res.status(401).json({ message: 'Missing auth token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    console.log(
      '✅ JWT validated for user:',
      (decoded as any).githubUsername || 'unknown'
    );

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (err: any) {
    console.log('❌ JWT validation failed:', err.message);
    // If token expired, provide more helpful error
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ 
        message: 'Token expired', 
        expiredAt: err.expiredAt 
      });
    } else {
      res.status(403).json({ message: 'Invalid or expired token' });
    }
  }
};
