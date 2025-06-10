// server/models/query.model.ts
import mongoose, { Schema } from 'mongoose';
const querySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userPrompt: { type: String, required: true },
    answer: { type: String },
    file: { type: String },
    startLine: { type: Number },
    endLine: { type: Number },
    role: { type: String, enum: ['user', 'assistant'], default: 'user' },
    sessionId: { type: String },
    tags: { type: [String], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } }); // createdAt only
const Query = mongoose.model('Query', querySchema);
export default Query;
