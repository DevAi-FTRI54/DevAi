import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct location
dotenv.config({ path: path.join(process.cwd(), 'src/config/.env') });

// Debug: Check if training tokens are loaded
console.log('🔍 Debug - Environment variables loaded:');
console.log(
  '🔍 INTERNAL_TEAM_TOKEN:',
  process.env.INTERNAL_TEAM_TOKEN ? 'SET' : 'NOT SET'
);
console.log(
  '🔍 FINE_TUNING_TOKEN:',
  process.env.FINE_TUNING_TOKEN ? 'SET' : 'NOT SET'
);

import './features/indexing/index.job.js';

console.log('Booting server...');
console.log('Start of server.ts');

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

    // Qdrant setup (optional - server continues without it)
    try {
      await ensureQdrantIndexes();
      console.log('✅ Qdrant indexes ready');
    } catch (error) {
      // Silently ignore Qdrant connection issues - server continues normally
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    app
      .listen(port, () => {
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
