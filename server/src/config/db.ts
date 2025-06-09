// Establishes and exports MongoDB connection for use throughout the app.
import mongoose from 'mongoose';

// Production MongoDB Atlas URI as fallback
const myURI =
  'mongodb+srv://ershankman:OmfLabBfAmk5E1fa@devai.mmwutzd.mongodb.net/devai?retryWrites=true&w=majority';
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
