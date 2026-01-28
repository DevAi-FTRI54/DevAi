// Represents project metadata (e.g., repo path, indexing status) in the database.
import mongoose, { Schema } from 'mongoose';
const projectSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repoName: { type: String, required: true },
    repoPath: { type: String, required: true },
    repoUrl: { type: String, required: true },
    repo: { type: Schema.Types.ObjectId, ref: 'Repo' },
    lastindexed: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'indexed', 'error'],
        default: 'pending',
    },
});
const Project = mongoose.model('Project', projectSchema);
export default Project;
