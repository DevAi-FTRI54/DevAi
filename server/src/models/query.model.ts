// server/models/query.model.ts

import mongoose, { Document, Schema } from 'mongoose';

export interface IQuery extends Document {
  user: mongoose.Types.ObjectId; //user type is objectID
  question: string; // question asked
  userPrompt: string;
  answer: string;
  file: string;
  createdAt: Date;
  response?: string; // Optional AI response or result
  role?: 'user' | 'assistant';
  startLine: number;
  endLine: number;
  sessionId?: string;
  tags?: string[]; // Optional: for categorization
}

const querySchema = new Schema<IQuery>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userPrompt: { type: String, required: true },
    answer: { type: String },
    file: { type: String },
    startLine: { type: Number },
    endLine: { type: Number },
    role: { type: String, enum: ['user', 'assistant'], default: 'user' },
    sessionId: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
); // createdAt only

const Query = mongoose.model<IQuery>('Query', querySchema);

export default Query;
