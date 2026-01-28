/**
 * MongoDB Connection Setup
 *
 * This file handles connecting to our MongoDB database, which stores all our application data:
 * - User accounts and authentication info
 * - Conversation history and chat sessions
 * - Repository metadata and indexing status
 *
 * We use Mongoose as our ODM (Object Document Mapper) - it's like an ORM but for MongoDB.
 * It gives us nice features like schema validation, middleware, and type safety.
 *
 * The connection is established lazily (when connectMongo() is called) rather than at
 * module load time, which gives us more control over when and how we connect. This is
 * especially helpful during server startup when we want to start the HTTP server first
 * (so deployment platforms know we're alive) and then connect to databases in the background.
 */
import mongoose from 'mongoose';
import { MONGODB_URI } from './env.validation.js';
import { logger } from '../utils/logger.js';

/**
 * Connect to MongoDB
 *
 * This function establishes the connection to our MongoDB instance. We use the validated
 * MONGODB_URI from our environment configuration, which ensures we have a valid connection
 * string before we even try to connect.
 *
 * If the connection fails, we log the error and exit the process. This might seem harsh,
 * but it's better to fail fast during startup than to have a partially-working server that
 * can't save any data!
 *
 * @returns Promise that resolves to the mongoose instance once connected
 */
export const connectMongo = async (): Promise<typeof mongoose> => {
  try {
    // Connect using the validated MongoDB URI from our environment config
    // Mongoose will handle connection pooling and reconnection logic for us
    await mongoose.connect(MONGODB_URI);
    return mongoose;
  } catch (err: any) {
    // If connection fails, log the error with context and exit
    // This ensures we don't start a server that can't persist data
    logger.error('Error while connecting to MongoDB', { err });
    process.exit(1);
  }
};
