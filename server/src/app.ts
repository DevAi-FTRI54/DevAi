import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { ServerError } from './types/types.js';
import cookieParser from 'cookie-parser';
import path from 'path';
//import { allowedOrigins } from '../src/config/allowedOrigins.js';
import mongoose from 'mongoose';
// import taskController from './controllers/taskController';

import repoRoutes from './features/indexing/index.routes.js';
import queryRoutes from './features/queries/query.routes.js';
import authRoute from './features/auth/auth.routes.js';
import chatHistoryRoute from './features/chatHistory/chatHistory.routes.js';

const app = express();

// --- Global middleware -----------------------------------------

// app.use(
//   cors({
//     origin: ['http://localhost:5173', 'https://a59d8fd60bb0.ngrok.app'],
//     credentials: true,
//   })
// );
const allowedOrigins = [
  'https://devai-three.vercel.app',
  'https://devai-eshankman-devai-app.vercel.app',
  'https://devai-devai-app.vercel.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('❌ Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// app.use(
//   cors({
//     origin: allowedOrigins, // your React dev host
//     credentials: true, // allow cookies
//   })
// );

// app.use(
//   cors({
//     origin: 'http://localhost:5173', // or your React dev server domain
//     credentials: true,
//   })
// );

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); // for form submissions, fix fromat so page loads
app.use(express.static('assets')); // serve files in assets

// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../views/index.html'), {
//     headers: { 'Content-Type': 'text/html' },
//   });
// });

app.get('/api/health', (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  console.log('🔍 Health check - Mongo ready?', mongoReady);

  res.status(200).json({
    mongo: mongoReady,
    server: true,
    timestamp: new Date().toISOString(),
  });
});

// --- Define routes ---------------------------------------------
// Repo route
app.use('/api/index', repoRoutes);

// Query LLM route
app.use('/api/query', queryRoutes);

// Auth route
app.use('/api/auth', authRoute);

//ChatHistory route
app.use('/api/chat', chatHistoryRoute);

// --- Tasks route -----------------------------------------------
// app.post('/api/tasks', taskController.postTask);

// app.get('/api/tasks', taskController.getTasks);
// app.delete('/api/tasks/:id', taskController.deleteTask);

// --- Authentication --------------------------------------------
// app.post('/signin', authController.verifyUser, (req, res) => {
//   res.redirect('/secret'); //
// });

// app.get('/secret', (req, res) => {
//   const token = req.cookies.token;

//   if (token !== 'admin') {
//     return res.send('You must be signed in to view this page');
//   }
//   res.sendFile(path.join(__dirname, '../views/secret.html'), {
//     headers: { 'Content-Type': 'text/html' },
//   });
// });

// --- Eror Handler ----------------------------------------------
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// --- Global error handler --------------------------------------
const errorHandler: ErrorRequestHandler = (
  err: ServerError,
  _req,
  res,
  _next
) => {
  const defaultError: ServerError = {
    log: 'Express error handler caught unknown middleware error',
    status: 500,
    message: { err: 'An error occurred' },
  };
  const errorObj: ServerError = { ...defaultError, ...err };
  console.log(errorObj.log);
  res.status(errorObj.status).json(errorObj.message);
};
app.use(errorHandler);

export default app;
