/**
 * Rate Limiting Middleware
 *
 * Rate limiting is like having a friendly bouncer who makes sure no one person (or IP address)
 * can overwhelm our server with too many requests. This protects us from:
 * - DDoS attacks (someone trying to crash our server with too many requests)
 * - Cost spikes (preventing runaway API calls that could get expensive)
 * - Resource exhaustion (making sure one user doesn't hog all our server resources)
 *
 * We use different rate limits for different types of endpoints:
 * - General API: More lenient (100 requests per 15 minutes) for normal usage
 * - Authentication: Very strict (5 requests per 15 minutes) to prevent brute force attacks
 * - Query endpoints: Moderate (10 requests per minute) since AI queries are more resource-intensive
 *
 * If someone exceeds their limit, we return a friendly 429 (Too Many Requests) error with
 * information about when they can try again. It's not personal - we just want to keep
 * the server running smoothly for everyone!
 */
import rateLimit from 'express-rate-limit';
/**
 * General API Rate Limiter
 *
 * This is our default rate limiter for most API endpoints. It allows 100 requests per
 * 15 minutes per IP address, which is generous enough for normal usage but strict enough
 * to prevent abuse.
 *
 * We use the standard rate limit headers so clients can see how many requests they have
 * left and when the limit resets. This helps developers understand when they're approaching
 * limits and adjust their usage accordingly.
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes - a good balance between strict and permissive
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Don't use the deprecated `X-RateLimit-*` headers
    handler: (req, res) => {
        // Custom handler to provide more helpful error information
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime
                ? (req.rateLimit.resetTime - Date.now()) / 1000
                : 15 * 60), // Tell them how many seconds to wait
        });
    },
});
/**
 * Authentication Rate Limiter
 *
 * This is much stricter than the general limiter because authentication endpoints are
 * prime targets for brute force attacks. Someone trying to guess passwords or tokens
 * could make thousands of requests very quickly.
 *
 * We limit to 5 requests per 15 minutes, which is enough for legitimate login attempts
 * (including a few retries if the user mistypes their password) but makes brute force
 * attacks impractical.
 *
 * The `skipSuccessfulRequests` option is clever - if a request succeeds (user logs in),
 * we don't count it against the limit. This means legitimate users who get their password
 * right on the first try aren't penalized, but attackers who keep failing will hit the
 * limit quickly.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 login attempts per 15 minutes - very strict to prevent brute force
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true, // Don't count successful logins against the limit
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many authentication attempts',
            message: 'Please wait before trying to authenticate again. This helps protect your account from brute force attacks.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime
                ? (req.rateLimit.resetTime - Date.now()) / 1000
                : 15 * 60),
        });
    },
});
/**
 * Query Rate Limiter (AI Endpoints)
 *
 * AI queries are more resource-intensive than regular API calls - they involve:
 * - Vector database searches
 * - LLM API calls (which cost money)
 * - Processing and generating responses
 *
 * So we limit these more strictly: 10 requests per minute per IP. This prevents:
 * - Cost spikes from runaway AI queries
 * - Server overload from too many concurrent AI operations
 * - Abuse of our AI resources
 *
 * The 1-minute window is shorter than the others because we want to allow bursts of
 * queries (like when a user is exploring their codebase), but prevent sustained abuse.
 */
export const queryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute - shorter window for AI queries
    max: 10, // 10 queries per minute - enough for active exploration, but prevents abuse
    message: 'Too many queries, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Query rate limit exceeded',
            message: 'You\'re making queries too quickly. Please slow down to ensure quality responses for everyone.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime
                ? (req.rateLimit.resetTime - Date.now()) / 1000
                : 60),
        });
    },
});
