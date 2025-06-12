import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';

interface TeamAuthenticatedRequest extends Request {
  user: jwt.JwtPayload | string;
  isTeamMember: boolean;
}

/**
 * Team authentication middleware for internal fine-tuning operations
 * Supports both regular user auth and team tokens
 */
export const requireTeamAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check for team token in header first
  const authHeader = req.headers.authorization;
  const teamToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  // Team token for internal operations
  if (teamToken) {
    const validTeamTokens = [
      process.env.INTERNAL_TEAM_TOKEN,
      process.env.FINE_TUNING_TOKEN,
      // Add more team tokens as needed
    ].filter(Boolean);

    console.log('🔍 Debug - Team token received:', teamToken);
    console.log('🔍 Debug - Valid team tokens:', validTeamTokens);

    if (validTeamTokens.includes(teamToken)) {
      console.log('✅ Team token authenticated for training operations');
      (req as TeamAuthenticatedRequest).isTeamMember = true;
      (req as TeamAuthenticatedRequest).user = {
        role: 'team',
        userId: 'internal',
      };
      next();
      return;
    }
  }

  // Fall back to regular user auth (cookie-based)
  const token = req.cookies.token;
  if (!token) {
    res.status(401).json({ message: 'Missing auth token or team credentials' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    console.log('✅ User JWT authenticated for training operations');

    (req as TeamAuthenticatedRequest).user = decoded;
    (req as TeamAuthenticatedRequest).isTeamMember = false;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};
