// server/models/query.model.ts

import mongoose, { Document, Schema } from 'mongoose';

export interface IQuery extends Document {
  user: mongoose.Types.ObjectId; //user type is objectID
  question: string; // question asked
  createdAt: Date;
  response?: string; // Optional AI response or result
  role?: 'user' | 'assistant';
  sessionId?: string;
  tags?: string[]; // Optional: for categorization
}

const querySchema = new Schema<IQuery>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    response: { type: String },
    role: { type: String, enum: ['user', 'assistant'], default: 'user' },
    sessionId: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
); // createdAt only

const Query = mongoose.model<IQuery>('Query', querySchema);

export default Query;
