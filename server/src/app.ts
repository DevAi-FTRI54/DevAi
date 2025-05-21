import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { ServerError } from './types/types.js';
import repoRoute from './features/indexing/index.routes.js';

// import types
// import controllers

const app = express();
app.use(cors());
app.use(express.json());

// Define routes
app.use('/repo', repoRoute);

// Define global error handler
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
