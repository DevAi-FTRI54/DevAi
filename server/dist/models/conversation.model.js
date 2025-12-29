import mongoose, { Schema } from 'mongoose';
const conversationSchema = new Schema({
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
}, {
    timestamps: true, // automatically adds createdAt and updatedAt
});
const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
