import jwt from 'jsonwebtoken';
import { FINE_TUNING_TOKEN, INTERNAL_TEAM_TOKEN, JWT_SECRET, } from '../config/env.validation.js';
import { logger } from '../utils/logger.js';
/**
 * Team authentication middleware for internal fine-tuning operations
 * Supports both regular user auth and team tokens
 */
export const requireTeamAuth = (req, res, next) => {
    // Check for team token in header first
    const authHeader = req.headers.authorization;
    const teamToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
    // Team token for internal operations
    if (teamToken) {
        const validTeamTokens = [
            INTERNAL_TEAM_TOKEN,
            FINE_TUNING_TOKEN,
            // Add more team tokens as needed
        ].filter(Boolean);
        logger.debug('🔍 Team token auth attempt', {
            hasTeamToken: true,
            validTeamTokensConfigured: validTeamTokens.length,
        });
        if (validTeamTokens.includes(teamToken)) {
            logger.info('✅ Team token authenticated for training operations');
            req.isTeamMember = true;
            req.user = {
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
        // Verify token using validated JWT secret from environment configuration
        const decoded = jwt.verify(token, JWT_SECRET);
        logger.debug('✅ User JWT authenticated for training operations');
        req.user = decoded;
        req.isTeamMember = false;
        next();
    }
    catch (err) {
        logger.warn('❌ Training/team auth JWT failed', {
            url: req.originalUrl,
            ip: req.ip,
        });
        res.status(403).json({ message: 'Invalid or expired token' });
    }
};
