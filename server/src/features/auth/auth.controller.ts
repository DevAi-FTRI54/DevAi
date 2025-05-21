// Contains controller functions for handling auth route requests and responses.
import { Request, Response, NextFunction } from 'express';

const authController = {
  verifyUser: (req: Request, res: Response, next: NextFunction) => {
    console.log('verifyUser works');

    const inputUsername = req.body.user;
    const inputPassword = req.body.pass;

    console.log('Login attempt:', req.body);

    if (inputUsername === 'codesmith' && inputPassword === 'ilovetesting') {
      res.cookie('token', 'admin', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });
      return next();
    } else {
      return res.status(401).send('Unsuccessful login attempt');
    }
  },
};

export default authController;
