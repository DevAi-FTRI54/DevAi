import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import 'dotenv/config';

// Worker is loaded after listen (dynamic import) so heavy deps (ts-morph, LangChain, etc.)
// don't block the server from binding the port. Render sees the service as up much sooner.

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

  // Load index job worker after port is bound (heavy: ts-morph, LangChain, BullMQ)
  import('./features/indexing/index.job.js')
    .then(() => console.log('✅ Index job worker loaded'))
    .catch((err) => {
      console.error(
        '⚠️ Index job worker failed to load (jobs will not run):',
        err,
      );
    });
}

// Execute the startup function
startServer().catch((error) => {
  console.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});
