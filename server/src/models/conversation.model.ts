import mongoose, { Schema } from 'mongoose';

// {
//   _id: ObjectId,
//   interactionId: 'session_23409823',
//   userId: 'user_example',
//   repoUrl: 'github.com/user/repo',
//   messages: [
//     {
//       role: 'user',
//       content: 'What is the main function?',
//       timestamp: ISODate,
//     },
//     {
//       role: 'assistant',
//       content: 'The main function is...',
//       snippet: 'function main() {...}',
//       file: 'app.js',
//       startLine: 10,
//       endLine: 20,
//       timestamp: ISODate,
//     }
//   ],
//   createdAt: ISODate,
//   updatedAt: ISODate
// }

export type Citations = {
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export type Message = {
  role: 'user' | 'assistant';
  content: string; // Always the main text
  citations?: Citations[]; // Only for assistant
  timestamp: Date;
};

export interface IConversation {
  sessionId: string;
  userId?: string;
  repoUrl: string;
  messages: Message[];
}

const conversationSchema = new Schema<IConversation>(
  {
    sessionId: { type: String, required: true },
    userId: { type: String, required: true },
    repoUrl: { type: String, required: true },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        citations: {
          type: [
            {
              file: { type: String },
              startLine: { type: Number },
              endLine: { type: Number },
              snippet: { type: String },
            },
          ],
          default: undefined,
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  }
);

const Conversation = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);
export default Conversation;
