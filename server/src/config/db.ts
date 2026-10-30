// Establishes and exports MongoDB connection for use throughout the app.
import mongoose from 'mongoose';

const myURI = 'mongodb://localhost:27017';
const URI = process.env.MONGO_URI || myURI;

export const connectMongo = async (): Promise<typeof mongoose> => {
  try {
    await mongoose.connect(URI);
    // console.log('✅ Connected to MongoDB');
    return mongoose;
  } catch (err: any) {
    console.error('Error while connecting to MongoDB:', err);
    process.exit(1);
  }
};
