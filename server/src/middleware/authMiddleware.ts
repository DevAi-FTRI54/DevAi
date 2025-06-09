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
  // Get token from cookie instead of header!
  const token = req.cookies.token;
  if (!token) {
    res.status(401).json({ message: 'Missing auth token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    console.log('Decoded JWT in requireAuth:', decoded);

    (req as AuthenticatedRequest).user = decoded;
    console.log('Decoded JWT in requireAuth:', decoded);

    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};
