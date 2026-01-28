import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { logger } from './utils/logger.js';
// ES modules don't have __dirname - need to create it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// import taskController from './controllers/taskController';
import repoRoutes from './features/indexing/index.routes.js';
import queryRoutes from './features/queries/query.routes.js';
import authRoute from './features/auth/auth.routes.js';
import chatHistoryRoute from './features/chatHistory/chatHistory.routes.js';
import trainingRoutes from './features/training/training.routes.js';
import { apiLimiter, authLimiter, queryLimiter } from './middleware/rateLimiter.js';
const app = express();
// --- Global middleware -----------------------------------------
/**
 * CORS Configuration
 *
 * CORS (Cross-Origin Resource Sharing) controls which websites can make requests to our API.
 * This is a security feature that prevents malicious websites from accessing our API on behalf
 * of users.
 *
 * We get the allowed origins from our environment configuration, which makes it easy to update
 * them for different environments (development, staging, production) without changing code.
 *
 * The origins are stored as a comma-separated string in the environment variable, and we
 * convert it to an array here for easier use with the CORS middleware.
 */
import { getAllowedOrigins } from './config/env.validation.js';
const allowedOrigins = getAllowedOrigins();
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('❌ Not allowed by CORS'));
        }
    },
    credentials: true,
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'X-Requested-With',
    ], // Explicitly allow Authorization header for Safari
    exposedHeaders: ['Authorization'], // Expose Authorization header in response
}));
// Handle CORS preflight requests (OPTIONS) - Safari requires this for custom headers
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin || '')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With'); // Explicitly allow Authorization header
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
    }
    next();
});
// app.use(
//   cors({
//     origin: allowedOrigins, // your React dev host
//     credentials: true, // allow cookies
//   })
// );
// app.use(
//   cors({
//     origin: 'http://localhost:5173', // or your React dev server domain
//     credentials: true,
//   })
// );
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); // for form submissions, fix fromat so page loads
app.use(express.static('assets')); // serve files in assets
// Root route - return API info instead of trying to serve missing HTML file
app.get('/', (req, res) => {
    res.json({
        message: 'DevAI API Server',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            ready: '/api/ready',
            keepAlive: '/api/keep-alive',
            index: '/api/index',
            query: '/api/query',
            auth: '/api/auth',
            chat: '/api/chat',
            training: '/api/training',
        },
    });
});
/**
 * Health Check Endpoint
 *
 * Production-ready health checks typically split into two endpoints:
 * - Liveness: "is the process up?" (should return 200 if the server can respond)
 * - Readiness: "can the server actually do useful work?" (should be non-200 if critical deps are down)
 *
 * Many deployment platforms only need a liveness check to avoid restart loops during
 * dependency outages, but your monitoring/traffic routing should use readiness.
 */
app.get('/api/health', (req, res) => {
    // Liveness probe: if we can respond, the process is alive.
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            server: {
                status: 'running',
                uptime: process.uptime(), // How long the server has been running (in seconds)
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
                },
            },
        },
    });
});
/**
 * Readiness check - returns non-200 if critical dependencies aren't ready.
 *
 * Right now we treat MongoDB as the critical dependency because most routes depend on it.
 * If you decide Qdrant/Redis are also critical for "ready", add checks here.
 */
app.get('/api/ready', (req, res) => {
    // mongoose.connection.readyState values:
    // 0 = disconnected
    // 1 = connected
    // 2 = connecting
    // 3 = disconnecting
    const mongodbState = mongoose.connection.readyState;
    const isMongoConnected = mongodbState === 1;
    const isReady = isMongoConnected;
    res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        services: {
            mongodb: {
                status: isMongoConnected ? 'connected' : 'disconnected',
                readyState: mongodbState,
            },
        },
    });
});
/**
 * Keep-alive endpoint - a simple way to prevent our service from going to sleep!
 *
 * Render's free tier has a feature where services "spin down" after 15 minutes of inactivity
 * to save resources. That's great for cost savings, but it means the first request after idle
 * time can be slow (cold start).
 *
 * This endpoint is designed to be pinged periodically (every 5-10 minutes) by an external
 * service like UptimeRobot or cron-job.org. It's like a gentle nudge saying "Hey, I'm still
 * here!" so the service stays warm and ready to respond quickly to real user requests.
 *
 * It's a simple endpoint that just confirms we're alive - no heavy lifting, just a friendly
 * wave to keep the service awake!
 */
app.get('/api/keep-alive', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        message: 'Service is active',
    });
});
// --- Apply Rate Limiting ---------------------------------------
// Apply general rate limiter to all API routes
// This protects us from abuse while still allowing normal usage
app.use('/api', apiLimiter);
// Apply stricter rate limiters to specific routes
// Authentication endpoints get extra protection against brute force attacks
app.use('/api/auth', authLimiter);
// Query endpoints (AI operations) get moderate limits to prevent cost spikes
app.use('/api/query', queryLimiter);
// --- Define routes ---------------------------------------------
// Repo route
app.use('/api/index', repoRoutes);
// Query LLM route
app.use('/api/query', queryRoutes);
// Auth route
app.use('/api/auth', authRoute);
//ChatHistory route
app.use('/api/chat', chatHistoryRoute);
// Training route (for fine-tuning data export)
app.use('/api/training', trainingRoutes);
// --- Tasks route -----------------------------------------------
// app.post('/api/tasks', taskController.postTask);
// app.get('/api/tasks', taskController.getTasks);
// app.delete('/api/tasks/:id', taskController.deleteTask);
// --- Authentication --------------------------------------------
// app.post('/signin', authController.verifyUser, (req, res) => {
//   res.redirect('/secret'); //
// });
// app.get('/secret', (req, res) => {
//   const token = req.cookies.token;
//   if (token !== 'admin') {
//     return res.send('You must be signed in to view this page');
//   }
//   res.sendFile(path.join(__dirname, '../views/secret.html'), {
//     headers: { 'Content-Type': 'text/html' },
//   });
// });
// --- Eror Handler ----------------------------------------------
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});
/**
 * Global Error Handler
 *
 * This is our safety net - it catches any errors that weren't handled by specific
 * route handlers or middleware. It's like having a friendly assistant who makes
 * sure we always respond to requests, even when something unexpected goes wrong.
 *
 * The error handler:
 * - Logs detailed error information (URL, error type, message, stack trace)
 * - Returns appropriate HTTP status codes
 * - Provides helpful error messages to API consumers
 * - Handles special cases (CORS errors, favicon requests) gracefully
 *
 * We use structured logging here so we can easily search and analyze errors in
 * production. This helps us identify patterns and fix issues quickly.
 */
const errorHandler = (err, req, res, _next) => {
    // Extract error message (could be string or object)
    const errorMessage = typeof err.message === 'string'
        ? err.message
        : err.message?.err || 'Unknown error';
    const errorName = err.name || 'Error';
    // Log actual error details for debugging
    // We include the request URL and method so we can see what endpoint caused the error
    logger.error('❌ Express error handler triggered:', {
        url: `${req.method} ${req.originalUrl}`,
        errorName,
        errorMessage,
        stack: err.stack,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    // Handle CORS errors gracefully (don't log as critical errors)
    // CORS errors are expected when unauthorized origins try to access our API
    if (errorMessage.includes('CORS') || errorMessage.includes('Not allowed by CORS')) {
        logger.warn('⚠️ CORS error (expected for unauthorized origins):', {
            origin: req.headers.origin,
            url: req.originalUrl,
        });
        res.status(403).json({ error: 'CORS: Origin not allowed' });
        return;
    }
    // Handle favicon requests (common source of 404s, not real errors)
    // Browsers automatically request favicon.ico, and we don't serve one, so we
    // just return 404 silently without logging it as an error
    if (req.originalUrl === '/favicon.ico') {
        res.status(404).end();
        return;
    }
    // Build error response
    // We use the error's own status code if provided, otherwise default to 500
    const defaultError = {
        log: err.log || errorMessage || 'Express error handler caught unknown middleware error',
        status: err.status || 500,
        message: { err: errorMessage },
    };
    const errorObj = { ...defaultError, ...err };
    // Send error response to client
    // We don't include stack traces in production responses (security best practice)
    res.status(errorObj.status).json(errorObj.message);
};
app.use(errorHandler);
export default app;
