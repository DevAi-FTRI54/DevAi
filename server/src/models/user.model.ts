// Defines the User model schema and interface for MongoDB and TypeScript.
import mongoose, { Document, Schema } from 'mongoose';

console.log('Loading user.model.ts');

export interface IUser extends Document {
  //allows Typescript to properly type User model
  githubId: string;
  username: string;
  avatarUrl: string;
  accessToken: string;
  email: string;
  passwordHash: string;
  installationId?: number;
  createdAt: Date;
  updatedAt: Date;
  //queries: mongoose.Types.ObjectId[]; //reference to Query documents
}

const userSchema = new mongoose.Schema<IUser>( //uses created typing from line 4
  {
    githubId: { type: String, required: true, unique: true }, // GitHub unique user ID
    username: { type: String, required: true }, // GitHub username
    avatarUrl: { type: String }, // Optional: GitHub avatar
    email: { type: String }, // Optional: public GitHub email
    accessToken: { type: String }, // (Optional) only if you want to make GitHub API requests
    installationId: { type: Number }, //(Optional) only if User has already installed github APP
    createdAt: { type: Date, default: Date.now },
    //queries: [{ type: Schema.Types.ObjectId, ref: 'Query' }],
    //Array of documents of type ObjectID, each refers to a doc in Query collection;
  },
  { timestamps: true } //created at + updated at, does both;
);

const User = mongoose.model('User', userSchema);

export default User;
