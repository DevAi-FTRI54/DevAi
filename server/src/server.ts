import app from './app.js';
import { connectMongo } from './config/db.js';
import 'dotenv/config';

import './features/indexing/index.job.js';

const port = process.env.PORT || 4000;

await connectMongo();

app
  .listen(port, () => {
    console.log(`✅ App listening on port ${port}`);
  })
  .on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
