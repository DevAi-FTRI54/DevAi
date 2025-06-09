import mongoose from 'mongoose';
import Conversation from '../../models/conversation.model.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct location
dotenv.config({ path: path.join(process.cwd(), 'src/config/.env') });

const conversationPairs = [
  {
    user: 'How does authentication work in this React app?',
    assistant:
      'Authentication in this React app is implemented using JWT tokens. The auth flow starts in the AuthContext provider, which manages login state and token storage. When a user logs in, the token is stored in localStorage and included in subsequent API requests via the Authorization header.',
    citations: [
      {
        file: 'src/context/AuthContext.tsx',
        startLine: 15,
        endLine: 30,
        snippet:
          "const login = async (credentials) => { const token = await api.login(credentials); localStorage.setItem('token', token); }",
      },
    ],
  },
  {
    user: 'What is the purpose of this useEffect hook?',
    assistant:
      'This useEffect hook is responsible for fetching user data when the component mounts and whenever the userId prop changes. It includes a cleanup function to cancel any pending requests if the component unmounts, preventing memory leaks and race conditions.',
    citations: [
      {
        file: 'src/components/UserProfile.tsx',
        startLine: 25,
        endLine: 40,
        snippet:
          'useEffect(() => { const controller = new AbortController(); fetchUserData(userId, controller.signal); return () => controller.abort(); }, [userId]);',
      },
    ],
  },
  {
    user: 'How do I add a new API endpoint to the Express server?',
    assistant:
      'To add a new API endpoint, create a route handler in the appropriate routes file under src/routes/. Define your endpoint using router.get(), router.post(), etc., then register the route in app.js. Follow the existing pattern with middleware for authentication and validation as needed.',
    citations: [
      {
        file: 'src/routes/api.js',
        startLine: 10,
        endLine: 25,
        snippet:
          "router.post('/api/users', authenticateToken, validateUserData, async (req, res) => { // endpoint logic here });",
      },
    ],
  },
  {
    user: 'What testing framework is used in this project?',
    assistant:
      'This project uses Jest as the primary testing framework, along with React Testing Library for component testing. Test files are located in __tests__ directories and follow the naming convention *.test.js or *.spec.js.',
    citations: [
      {
        file: 'package.json',
        startLine: 20,
        endLine: 25,
        snippet:
          '"scripts": { "test": "jest --watchAll", "test:coverage": "jest --coverage" }',
      },
    ],
  },
  {
    user: 'How is state management handled in this application?',
    assistant:
      'State management is handled using React Context API for global state and local useState hooks for component-specific state. The app uses a combination of AuthContext for authentication state and ThemeContext for UI preferences.',
    citations: [
      {
        file: 'src/store/AppContext.tsx',
        startLine: 5,
        endLine: 20,
        snippet:
          "const AppContext = createContext({ user: null, theme: 'light', updateUser: () => {}, toggleTheme: () => {} });",
      },
    ],
  },
  {
    user: 'What database does this backend use?',
    assistant:
      'This backend uses MongoDB as the primary database with Mongoose ODM for object modeling. Database configuration is managed in config/database.js, and models are defined in the models/ directory following Mongoose schema patterns.',
    citations: [
      {
        file: 'config/database.js',
        startLine: 1,
        endLine: 15,
        snippet:
          "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });",
      },
    ],
  },
  {
    user: 'How do I handle form validation in React?',
    assistant:
      'Form validation in this React app is handled using a combination of controlled components and custom validation hooks. The useFormValidation hook provides reusable validation logic with real-time error checking and form submission handling.',
    citations: [
      {
        file: 'src/hooks/useFormValidation.js',
        startLine: 10,
        endLine: 25,
        snippet:
          'const useFormValidation = (initialState, validate) => { const [values, setValues] = useState(initialState); const [errors, setErrors] = useState({}); }',
      },
    ],
  },
  {
    user: "What's the purpose of this middleware function?",
    assistant:
      "This middleware function handles request logging and performance monitoring. It logs incoming requests with timestamps, tracks response times, and includes error handling for debugging purposes. It's applied globally to all routes in the Express application.",
    citations: [
      {
        file: 'src/middleware/logger.js',
        startLine: 5,
        endLine: 20,
        snippet:
          'const requestLogger = (req, res, next) => { const start = Date.now(); console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`); }',
      },
    ],
  },
  {
    user: 'How do I optimize React component performance?',
    assistant:
      'React component performance can be optimized using React.memo for preventing unnecessary re-renders, useMemo for expensive calculations, useCallback for function memoization, and code splitting with React.lazy for bundle optimization.',
    citations: [
      {
        file: 'src/components/OptimizedComponent.tsx',
        startLine: 1,
        endLine: 15,
        snippet:
          'const OptimizedComponent = React.memo(({ data }) => { const expensiveValue = useMemo(() => calculateExpensiveValue(data), [data]); });',
      },
    ],
  },
  {
    user: 'How does error handling work in this Express API?',
    assistant:
      'Error handling in this Express API uses a centralized error middleware that catches all errors and formats them consistently. Async route handlers are wrapped with error handling utilities to ensure proper error propagation.',
    citations: [
      {
        file: 'src/middleware/errorHandler.js',
        startLine: 1,
        endLine: 20,
        snippet:
          'const errorHandler = (err, req, res, next) => { const statusCode = err.statusCode || 500; res.status(statusCode).json({ error: err.message }); };',
      },
    ],
  },
];

async function createSampleData(): Promise<void> {
  try {
    // Connect to MongoDB using the production connection string
    const mongoUri =
      process.env.MONGO_URI ||
      'mongodb+srv://ershankman:OmfLabBfAmk5E1fa@devai.mmwutzd.mongodb.net/devai?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const users = ['user_1', 'user_2', 'user_3', 'user_4'];
    const repos = [
      'https://github.com/user/react-app',
      'https://github.com/team/backend-api',
      'https://github.com/dev/frontend-ui',
      'https://github.com/company/mobile-app',
    ];

    let created = 0;

    for (let i = 0; i < conversationPairs.length; i++) {
      const pair = conversationPairs[i];
      const sessionId = `session_${Math.random().toString(36).substr(2, 9)}`;
      const userId = users[i % users.length];
      const repoUrl = repos[i % repos.length];

      // Create conversation with proper user→assistant message pairs
      const conversation = new Conversation({
        sessionId,
        userId,
        repoUrl,
        messages: [
          {
            role: 'user',
            content: pair.user,
            timestamp: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
          },
          {
            role: 'assistant',
            content: pair.assistant,
            citations: pair.citations,
            timestamp: new Date(Date.now() - Math.random() * 3600000 + 60000), // Assistant responds after user
          },
        ],
      });

      await conversation.save();
      created++;
      console.log(`✅ Created conversation ${created}: ${sessionId}`);
    }

    console.log(`🎉 Successfully created ${created} training conversations!`);

    // Verify the data
    const total = await Conversation.countDocuments({});
    console.log(`📊 Total conversations in database: ${total}`);

    // Check training pairs specifically
    const trainingPairs = await Conversation.aggregate([
      { $unwind: '$messages' },
      {
        $group: {
          _id: '$sessionId',
          messages: { $push: '$messages' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: 2 } } },
      { $count: 'totalPairs' },
    ]);

    console.log(
      `🎯 Training pairs available: ${trainingPairs[0]?.totalPairs || 0}`
    );

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSampleData();
}

export { createSampleData };
