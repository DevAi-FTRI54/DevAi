import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import 'dotenv/config';

// Don't import worker immediately - it causes memory issues on Render
// We'll import it lazily after the server starts

console.log('Booting server...');
console.log('Start of server.ts');
console.log('🟡 Fresh deploy loaded');

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

const port = process.env.PORT || 4000;

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

  // Import worker lazily after server is running to avoid memory issues
  // This prevents the worker from consuming memory during server startup
  try {
    console.log('📦 Starting worker in background...');
    // Use dynamic import to load worker asynchronously
    await import('./features/indexing/index.job.js');
    console.log('✅ Worker started successfully');
  } catch (error) {
    console.error('⚠️ Worker failed to start (server will continue):', error);
    // Don't exit - server can still run without worker (jobs just won't process)
  }
}

// Execute the startup function
startServer().catch((error) => {
  console.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});
