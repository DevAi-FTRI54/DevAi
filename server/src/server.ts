import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import 'dotenv/config';

// Load worker at startup so BullMQ queue + worker exist before any /ingest request.
// (Deferring this broke ingestion: jobs were added before worker was ready.)
import './features/indexing/index.job.js';

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

const port = process.env.PORT || 4000;

async function startServer() {
  // Bind port first so Render can detect the service quickly
  const server = app.listen(Number(port), '0.0.0.0', () => {
    console.log(`✅ App listening on port ${port}`);
    console.log(`🌐 Server bound to 0.0.0.0:${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/api/health`);
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

  // Connect to Mongo and Qdrant in parallel (don't block listen)
  const mongoPromise = connectMongo()
    .then(() => console.log('✅ MongoDB connected'))
    .catch((error) => {
      console.error(
        '⚠️ MongoDB connection failed (server will continue):',
        error,
      );
    });
  const qdrantPromise = ensureQdrantIndexes()
    .then(() => console.log('✅ Qdrant indexes ready'))
    .catch((error) => {
      console.error('⚠️ Qdrant setup failed (server will continue):', error);
    });
  await Promise.all([mongoPromise, qdrantPromise]);
}

// Execute the startup function
startServer().catch((error) => {
  console.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});
