/**
 * Environment Variable Validation
 * 
 * This file is like a friendly bouncer at the door - it checks that all the environment
 * variables we need are present and valid before we even try to start the server. This way,
 * if something's missing or malformed, we fail fast with a helpful error message instead of
 * crashing mysteriously in the middle of handling a request.
 * 
 * We use Zod (a TypeScript-first schema validation library) to define what we expect from
 * each environment variable. Zod is great because it gives us:
 * - Type safety (TypeScript knows exactly what types our env vars are)
 * - Runtime validation (catches issues when the server starts, not later)
 * - Helpful error messages (tells us exactly what's wrong)
 * 
 * If validation fails, we print out exactly which variables are missing or invalid, making
 * it super easy to fix the .env file. It's like having a checklist that tells you exactly
 * what to fix!
 */

import { z } from 'zod';
import 'dotenv/config';

/**
 * Define our environment variable schema - this is like a contract that says
 * "these are the variables we need, and here's what they should look like"
 */
const envSchema = z.object({
  // Server Configuration
  // These control how our server runs and where it can be accessed from
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('The environment we're running in - affects logging, error handling, etc.'),
  
  PORT: z
    .string()
    .regex(/^\d+$/, 'Port must be a number')
    .transform(Number)
    .default('4000')
    .describe('The port our server will listen on'),
  
  // Database Connections
  // MongoDB stores our user data, conversations, and application state
  MONGODB_URI: z
    .string()
    .url('MongoDB URI must be a valid URL')
    .or(z.string().startsWith('mongodb://'))
    .describe('Connection string for MongoDB - where we store user data and conversations'),
  
  // Vector Database
  // Qdrant stores our code embeddings for semantic search
  QDRANT_URL: z
    .string()
    .url('Qdrant URL must be a valid URL')
    .describe('URL for Qdrant vector database - stores code embeddings for AI search'),
  
  QDRANT_API_KEY: z
    .string()
    .optional()
    .describe('Optional API key for Qdrant (if your instance requires authentication)'),
  
  // Redis (for job queues)
  // Redis powers our BullMQ job queue system for background processing
  REDIS_URL: z
    .string()
    .url('Redis URL must be a valid URL')
    .describe('Connection string for Redis - powers our background job processing'),
  
  // GitHub Integration
  // These are needed for GitHub OAuth and GitHub App functionality
  GITHUB_APP_ID: z
    .string()
    .min(1, 'GitHub App ID is required')
    .describe('Your GitHub App ID (found in GitHub App settings)'),
  
  GITHUB_APP_CLIENT_ID: z
    .string()
    .min(1, 'GitHub Client ID is required')
    .describe('GitHub OAuth Client ID for user authentication'),
  
  GITHUB_APP_CLIENT_SECRET: z
    .string()
    .min(1, 'GitHub Client Secret is required')
    .describe('GitHub OAuth Client Secret (keep this secret!)'),
  
  GITHUB_REDIRECT_URI: z
    .string()
    .url('GitHub Redirect URI must be a valid URL')
    .describe('Where GitHub should redirect users after OAuth (must match GitHub App settings)'),
  
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .min(1, 'GitHub App Private Key is required')
    .describe('GitHub App private key (PEM format) for authenticating as the app'),
  
  // Authentication & Security
  // JWT secret is used to sign and verify authentication tokens
  JWT_SECRET: z
    .string()
    .min(32, 'JWT Secret must be at least 32 characters for security')
    .describe('Secret key for signing JWT tokens (use a long, random string!)'),
  
  // AI/ML Services
  // OpenAI powers our code understanding and question answering
  OPENAI_API_KEY: z
    .string()
    .startsWith('sk-', 'Invalid OpenAI API key format (should start with sk-)')
    .describe('OpenAI API key for GPT models and embeddings'),
  
  COHERE_API_KEY: z
    .string()
    .optional()
    .describe('Optional Cohere API key for reranking search results (improves accuracy)'),
  
  // Frontend Configuration
  // Where our frontend is hosted - needed for CORS and redirects
  FRONTEND_BASE_URL: z
    .string()
    .url('Frontend URL must be a valid URL')
    .default('http://localhost:5173')
    .describe('Base URL of the frontend application (for CORS and redirects)'),
  
  // CORS Configuration
  // Comma-separated list of allowed origins for cross-origin requests
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .describe('Comma-separated list of allowed CORS origins'),
});

/**
 * Validate and parse the environment variables
 * 
 * This function does the actual validation work. If everything checks out, it returns
 * a typed object with all our environment variables. If something's wrong, it prints
 * helpful error messages and exits the process (better to fail early than run broken!).
 */
function validateEnv() {
  try {
    // Parse comma-separated origins into an array for easier use
    const rawEnv = {
      ...process.env,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    };
    
    // Validate against our schema - Zod will throw if anything's wrong
    return envSchema.parse(rawEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod gives us really helpful error messages - let's make them even friendlier!
      console.error('\n❌ Environment variable validation failed!\n');
      console.error('It looks like some environment variables are missing or invalid:\n');
      
      // Group errors by type for easier reading
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  → ${path}: ${err.message}`);
      });
      
      console.error('\n💡 Please check your .env file and ensure all required variables are set correctly.');
      console.error('   You can find an example .env file in the project documentation.\n');
      
      // Exit with an error code so deployment platforms know something's wrong
      process.exit(1);
    }
    
    // If it's not a Zod error, re-throw it (something unexpected happened)
    throw error;
  }
}

// Validate environment variables when this module is imported
// This means we'll catch configuration issues as soon as the server starts
export const env = validateEnv();

// Export individual values for convenience
// This way other files can import exactly what they need: `import { PORT } from './config/env.validation.js'`
export const {
  NODE_ENV,
  PORT,
  MONGODB_URI,
  QDRANT_URL,
  QDRANT_API_KEY,
  REDIS_URL,
  GITHUB_APP_ID,
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  GITHUB_APP_PRIVATE_KEY,
  JWT_SECRET,
  OPENAI_API_KEY,
  COHERE_API_KEY,
  FRONTEND_BASE_URL,
  ALLOWED_ORIGINS,
} = env;

/**
 * Helper function to get allowed origins as an array
 * 
 * CORS configuration needs origins as an array, but it's easier to store them as
 * a comma-separated string in environment variables. This function does the conversion
 * and handles edge cases like extra spaces.
 * 
 * @returns Array of allowed origin URLs
 */
export const getAllowedOrigins = (): string[] => {
  return ALLOWED_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0); // Remove any empty strings
};

