// Verifies JWT tokens and attaches user data to requests for protected routes.
import jwt from 'jsonwebtoken'; //install jsonwebtoken; install types
import { Request, Response, NextFunction, RequestHandler } from 'express';

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

export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization; //create variable for authorization header
  if (!authHeader)
    return res.status(401).json({ message: 'Missing auth header' });
  //if not present then return 401 status(unathaurized) and missing message;
  const token = authHeader.split(' ')[1];
  //authHeader is in format   Bearer <token>
  //split string into array using a space as the unit indicator, each unit is an index
  //grab second index which is the token

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    // 1) jwt.verify built in verification method, takes the token, the key and
    // 2) checks if token is signed with the key (secret)
    // 3) extracts the original data (decodes), username/pw etc

    (req as any).user = decoded; //needs added type, or .user won't be recognized as a request method
    //req.user = decoded is the JS version
    // Attach user info to the request
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};
