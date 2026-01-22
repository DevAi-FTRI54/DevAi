import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import 'dotenv/config';

// Import worker so it starts processing jobs from the queue
console.log('📦 Importing index job worker...');
import './features/indexing/index.job.js';
console.log('✅ Index job worker imported');

console.log('Booting server...');
console.log('Start of server.ts');
console.log('🟡 Fresh deploy loaded');

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
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
    console.log(`✅ App listening on port ${port}`);
    console.log(`🌐 Server bound to 0.0.0.0:${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/api/health`);
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

  // Connect to services in the background (don't block server startup)
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectMongo();
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('⚠️ MongoDB connection failed (server will continue):', error);
    // Don't exit - server can still run without MongoDB for health checks
  }

  try {
    console.log('🔄 Setting up Qdrant indexes...');
    await ensureQdrantIndexes();
    console.log('✅ Qdrant indexes ready');
  } catch (error) {
    console.error('⚠️ Qdrant setup failed (server will continue):', error);
    // Don't exit - server can still run without Qdrant for health checks
  }
}

// Execute the startup function
startServer().catch((error) => {
  console.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});
