import express from 'express';

console.log('🧪 App initialized');
import 'dotenv/config';

const app = express();

import cors from 'cors';
import cookieParser from 'cookie-parser';

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

console.log('🧩 Middleware initialized');

import authRoute from './features/auth/auth.routes.js';
app.use('/api/auth', authRoute);
console.log('✅ Auth route initialized');

app.get('/api/health', (_req, res) => {
  console.log('✅ Health check hit');
  res.status(200).json({ ok: true });
});

export default app;
