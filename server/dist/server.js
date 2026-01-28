/**
 * Server Startup
 *
 * This file handles starting our Express server and connecting to all the services we need:
 * - MongoDB (user data, conversations)
 * - Qdrant (vector database for code search)
 * - BullMQ worker (background job processing)
 *
 * We use a smart startup strategy: start the HTTP server first (so deployment platforms
 * know we're alive), then connect to databases in the background. This prevents deployment
 * timeouts while still ensuring everything is connected before we start handling requests.
 */
import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import { logger } from './utils/logger.js';
import 'dotenv/config';
// Import worker so it starts processing jobs from the queue
logger.info('📦 Importing index job worker...');
import './features/indexing/index.job.js';
logger.info('✅ Index job worker imported');
logger.info('Booting server...');
logger.info('Start of server.ts');
logger.info('🟡 Fresh deploy loaded');
// Handle uncaught exceptions - these are synchronous errors that would crash the process
// Winston's exception handler will log these, but we also log here for immediate visibility
process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', err);
});
// Handle unhandled promise rejections - these are async errors that could crash the process
// Winston's rejection handler will log these, but we also log here for immediate visibility
process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled Rejection:', reason);
});
/**
 * Server Startup
 *
 * This file handles starting our Express server and connecting to all the services we need:
 * - MongoDB (user data, conversations)
 * - Qdrant (vector database for code search)
 * - BullMQ worker (background job processing)
 *
 * We use a smart startup strategy: start the HTTP server first (so deployment platforms
 * know we're alive), then connect to databases in the background. This prevents deployment
 * timeouts while still ensuring everything is connected before we start handling requests.
 */
import { PORT } from './config/env.validation.js';
const port = PORT;
// await connectMongo();
async function startServer() {
    // Start server first so Render can detect the port
    // Then connect to services in the background
    const server = app.listen(Number(port), '0.0.0.0', () => {
        logger.info(`✅ App listening on port ${port}`);
        logger.info(`🌐 Server bound to 0.0.0.0:${port}`);
        logger.info(`🏥 Health check: http://localhost:${port}/api/health`);
    });
    server.on('error', (err) => {
        logger.error('❌ Failed to start server:', err);
        process.exit(1);
    });
    // Connect to services in the background (don't block server startup)
    // This allows the server to start quickly and respond to health checks, while
    // database connections happen asynchronously. If connections fail, we log warnings
    // but don't crash - the server can still respond to health checks.
    try {
        logger.info('🔄 Connecting to MongoDB...');
        await connectMongo();
        logger.info('✅ MongoDB connected');
    }
    catch (error) {
        logger.warn('⚠️ MongoDB connection failed (server will continue):', error);
        // Don't exit - server can still run without MongoDB for health checks
    }
    try {
        logger.info('🔄 Setting up Qdrant indexes...');
        await ensureQdrantIndexes();
        logger.info('✅ Qdrant indexes ready');
    }
    catch (error) {
        logger.warn('⚠️ Qdrant setup failed (server will continue):', error);
        // Don't exit - server can still run without Qdrant for health checks
    }
}
// Execute the startup function
startServer().catch((error) => {
    logger.error('❌ Unhandled error during startup:', error);
    process.exit(1);
});
