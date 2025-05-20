// Defines the User model schema and interface for MongoDB and TypeScript.
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  //allows Typescript to properly type User model
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  queries: mongoose.Types.ObjectId[]; //reference to Query documents
}

const userSchema = new mongoose.Schema<IUser>( //uses created typing from line 4
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    queries: [{ type: Schema.Types.ObjectId, ref: 'Query' }],
    //Array of documents of type ObjectID, each refers to a doc in Query collection;
  },
  { timestamps: true } //created at + updated at, does both;
);

const User = mongoose.model('User', userSchema);

export default User;
