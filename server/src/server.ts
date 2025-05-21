import express from 'express';
import authController from './features/auth/auth.controller.js';

const app = express();
const port = 3333;
const taskController = require('./controllers/taskController');

const mongoose = require('mongoose');

const myURI = 'mongodb://localhost:27017';
const URI = process.env.MONGO_URI || myURI;

mongoose
  .connect(URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err: any) => console.error('MongoDB connection error:', err));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use(express.static('assets')); //serve files in assets

const path = require('path');

app.use(express.urlencoded({ extended: true })); // for form submissions, fix fromat so page loads

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'), {
    headers: { 'Content-Type': 'text/html' },
  });
});

app.post('/signin', authController.verifyUser, (req, res) => {
  res.redirect('/secret'); //
});

app.get('/secret', (req, res) => {
  const token = req.cookies.token;

  if (token !== 'admin') {
    return res.send('You must be signed in to view this page');
  }
  res.sendFile(path.join(__dirname, '../views/secret.html'), {
    headers: { 'Content-Type': 'text/html' },
  });
});

// middleware
app.use(express.json());

// routes
app.post('/api/tasks', taskController.postTask);

app.get('/api/tasks', taskController.getTasks);
app.delete('/api/tasks/:id', taskController.deleteTask);

app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.use((err, req, res, next) => {
  console.error('🔥 Global error handler caught:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
