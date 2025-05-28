import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is missing');
  process.exit(1);
}

export function generateUserJWTToken(user: {
  _id: mongoose.Types.ObjectId | string;
  username: string;
}): string {
  return jwt.sign(
    { userId: user._id, githubUsername: user.username },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}
