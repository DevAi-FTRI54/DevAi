// Verifies JWT tokens and attaches user data to requests for protected routes.
import jwt from 'jsonwebtoken'; //install jsonwebtoken; install types
console.log('Loading authMiddleware.ts');
export const requireAuth = (req, res, next) => {
    // Check Authorization header first (Safari compatibility)
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        console.log('🔑 Using JWT from Authorization header');
    }
    else {
        // Fallback to cookie
        token = req.cookies.token;
        if (token) {
            console.log('🍪 Using JWT from cookie');
        }
    }
    if (!token) {
        console.log('❌ No JWT token found in header or cookie');
        res.status(401).json({ message: 'Missing auth token' });
        return;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ JWT validated for user:', decoded.githubUsername || 'unknown');
        req.user = decoded;
        next();
    }
    catch (err) {
        console.log('❌ JWT validation failed:', err.message);
        // If token expired, provide more helpful error
        if (err.name === 'TokenExpiredError') {
            res.status(401).json({
                message: 'Token expired',
                expiredAt: err.expiredAt,
            });
        }
        else {
            res.status(403).json({ message: 'Invalid or expired token' });
        }
    }
};
