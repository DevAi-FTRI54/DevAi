import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET environment variable is missing');
    process.exit(1);
}
export function generateUserJWTToken(user) {
    return jwt.sign({ userId: user._id, githubUsername: user.username }, JWT_SECRET, { expiresIn: '2h' });
}
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
