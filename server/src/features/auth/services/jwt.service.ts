/**
 * JWT Token Service
 * 
 * This service handles creating and verifying JWT (JSON Web Token) tokens for user authentication.
 * JWTs are like digital ID cards - they contain user information and are cryptographically signed
 * so we can verify they're authentic and haven't been tampered with.
 * 
 * We use JWTs because they're:
 * - Stateless (we don't need to store sessions in the database)
 * - Secure (cryptographically signed, can't be forged)
 * - Portable (can be used across different services)
 * 
 * The JWT secret comes from our validated environment configuration, so we know it's present
 * and secure (at least 32 characters) before we try to use it.
 */
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { JWT_SECRET } from '../../../config/env.validation.js';

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
