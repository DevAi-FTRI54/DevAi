import express from 'express';
import 'dotenv/config';
import mongoose from 'mongoose';
// import taskController from './controllers/taskController';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.get('/api/health', (req, res) => {
    const health = {
        mongodb: mongoose.connection.readyState === 1,
        server: true,
        timestamp: new Date().toISOString(),
    };
    const isHealthy = Object.values(health).every((status) => status === true);
    console.log('✅ Health check hit');
    res.status(isHealthy ? 200 : 503).json(health);
});
// --- Global middleware -----------------------------------------
//important!!
// app.use(
//   cors({
//     origin: ['http://localhost:5173', 'https://a59d8fd60bb0.ngrok.app'],
//     credentials: true,
//   })
// );
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
//important!!
// app.use(express.json());
// app.use(cookieParser());
// app.use(express.urlencoded({ extended: true })); // for form submissions, fix fromat so page loads
//app.use(express.static('assets')); // serve files in assets
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../views/index.html'), {
//     headers: { 'Content-Type': 'text/html' },
//   });
// });
// --- Define routes ---------------------------------------------
// Repo route
// app.use('/api/index', repoRoutes);
// // Query LLM route
// app.use('/api/query', queryRoutes);
// // Auth route
// app.use('/api/auth', authRoute);
// //ChatHistory route
// app.use('/api/chat', chatHistoryRoute);
//Health check
// app.get('/api/health', (req, res) => {
//   const health = {
//     mongodb: mongoose.connection.readyState === 1,
//     server: true,
//     timestamp: new Date().toISOString(),
//   };
//   const isHealthy = Object.values(health).every((status) => status === true);
//   res.status(isHealthy ? 200 : 503).json(health);
// });
// Serve static files from the React build folder
// app.use(express.static(path.join(__dirname, '../../client/dist')));
// // Fallback: serve index.html for all unmatched routes
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
// });
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
//Render Route handler
// app.get('/', (_req, res) => {
//   res.status(200).send('Backend is live');
// });
// //catch favicon error in Render
// app.use((req, res, next) => {
//   console.log(`🔍 Unmatched request: ${req.method} ${req.originalUrl}`);
//   next();
// });
// // --- Eror Handler ----------------------------------------------
// app.use((req, res, next) => {
//   const error = new Error('Route not found');
//   (error as any).status = 404;
//   next(error);
// });
// // --- Global error handler --------------------------------------
// const errorHandler: ErrorRequestHandler = (
//   err: ServerError,
//   _req,
//   res,
//   _next
// ) => {
//   const defaultError: ServerError = {
//     log: 'Express error handler caught unknown middleware error',
//     status: 500,
//     message: { err: 'An error occurred' },
//   };
//   const errorObj: ServerError = {
//     ...defaultError,
//     ...err,
//     message: err.message ? { err: String(err.message) } : defaultError.message,
//   };
//   console.error('❌ Global Error Handler Triggered:');
//   console.error('→ Name:', err.name);
//   console.error('→ Message:', err.message);
//   console.error('→ Stack:\n', err.stack);
//   res.status(errorObj.status).json(errorObj.message);
// };
export default app;
