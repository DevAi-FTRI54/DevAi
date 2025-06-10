import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import 'dotenv/config';

//import './features/indexing/index.job.js';

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
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectMongo();
    console.log('✅ MongoDB connected');

    console.log('🔄 Setting up Qdrant indexes...');
    await ensureQdrantIndexes();
    console.log('✅ Qdrant indexes ready');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    app
      .listen(Number(port), '0.0.0.0', () => {
        console.log(`✅ App listening on port ${port}`);
        console.log(`🏥 Health check: http://localhost:${port}/api/health`);
      })
      .on('error', (err) => {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
      });
  } catch (error) {
    console.error(
      '❌ Failed during initialization:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// Execute the startup function
startServer().catch((error) => {
  console.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});
