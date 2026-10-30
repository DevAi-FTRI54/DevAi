import app from './app.js';
import { connectMongo } from './config/db.js';
import 'dotenv/config';

// Don't import index.job or vector.service here — they pull in ts-morph, LangChain, etc.
// We listen first so /api/keep-alive and /api/health return 200 immediately. That way
// Render and UptimeRobot get a successful response and don't treat the service as asleep (503).
// Mongo, Qdrant, and the index worker load after listen in the background.

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

const port = process.env.PORT || 4000;

function startServer() {
  const server = app.listen(Number(port), '0.0.0.0', () => {
    console.log(`✅ App listening on port ${port}`);
    console.log(`🌐 Server bound to 0.0.0.0:${port}`);
    console.log(
      `🏥 Health / keep-alive: http://localhost:${port}/api/health and /api/keep-alive`,
    );
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

  // Load heavy deps and connect to services after listen (non-blocking)
  connectMongo()
    .then(() => console.log('✅ MongoDB connected'))
    .catch((e) =>
      console.error('⚠️ MongoDB connection failed (server will continue):', e),
    );

  import('./features/indexing/vector.service.js')
    .then((m) => m.ensureQdrantIndexes())
    .then(() => console.log('✅ Qdrant indexes ready'))
    .catch((e) =>
      console.error('⚠️ Qdrant setup failed (server will continue):', e),
    );

  import('./features/indexing/index.job.js')
    .then(() => console.log('✅ Index job worker loaded'))
    .catch((e) =>
      console.error(
        '⚠️ Index job worker failed to load (jobs will not run):',
        e,
      ),
    );
}

startServer();
