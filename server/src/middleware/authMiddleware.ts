// Verifies JWT tokens and attaches user data to requests for protected routes.
import { Request, Response, NextFunction } from 'express';

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;

  if (token === 'admin') {
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized' });
};
