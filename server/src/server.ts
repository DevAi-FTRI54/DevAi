import app from './app.js';
import { connectMongo } from './config/db.js';
import { ensureQdrantIndexes } from './features/indexing/vector.service.js';
import 'dotenv/config';

import './features/indexing/index.job.js';

const port = process.env.PORT || 4000;

// await connectMongo();

await Promise.all([connectMongo(), ensureQdrantIndexes()]);

app
  .listen(port, () => {
    console.log(`✅ App listening on port ${port}`);
  })
  .on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
