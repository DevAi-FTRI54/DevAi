import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET environment variable is missing');
    process.exit(1);
}
// Session duration: 7 days so users aren't logged out after a few hours of inactivity
const JWT_EXPIRY_SECONDS = process.env.JWT_EXPIRY_SECONDS
    ? parseInt(process.env.JWT_EXPIRY_SECONDS, 10)
    : 7 * 24 * 60 * 60; // 7 days in seconds
export function generateUserJWTToken(user) {
    return jwt.sign({ userId: user._id, githubUsername: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS });
}
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
