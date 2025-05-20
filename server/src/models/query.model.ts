// server/models/query.model.ts

import mongoose, { Document, Schema } from 'mongoose';

export interface IQuery extends Document {
  user: mongoose.Types.ObjectId; // Reference to User
  question: string; // What the user asked
  createdAt: Date; // When it was asked
  response?: string; // Optional AI response or result
  tags?: string[]; // Optional: for categorization
}

const querySchema = new Schema<IQuery>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    response: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
); // createdAt only

const Query = mongoose.model<IQuery>('Query', querySchema);

export default Query;
