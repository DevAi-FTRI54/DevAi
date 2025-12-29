// Verifies JWT tokens and attaches user data to requests for protected routes.
import jwt from 'jsonwebtoken'; //install jsonwebtoken; install types
console.log('Loading authMiddleware.ts');
export const requireAuth = (req, res, next) => {
    // Get token from cookie instead of header!
    const token = req.cookies.token;
    if (!token) {
        res.status(401).json({ message: 'Missing auth token' });
        return;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded JWT in requireAuth:', decoded);
        req.user = decoded;
        console.log('Decoded JWT in requireAuth:', decoded);
        next();
    }
    catch (err) {
        res.status(403).json({ message: 'Invalid or expired token' });
    }
};
