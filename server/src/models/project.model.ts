// Represents project metadata (e.g., repo path, indexing status) in the database.
import mongoose, { Document, Schema } from 'mongoose';

console.log('Loading project.model.ts');

export interface IProject extends Document {
  user: mongoose.Types.ObjectId; //user type is objectID
  repoName: string;
  repoPath: string; //filepath
  repoUrl: string; // url of repo/project
  lastindexed: Date; //last time the repo was indexed(ingested) (SHA)
  status: string; // option for already indexed, pending, error
}

const projectSchema = new Schema<IProject>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  repoName: { type: String, required: true },
  repoPath: { type: String, required: true },
  repoUrl: { type: String, required: true },
  lastindexed: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'indexed', 'error'],
    default: 'pending',
  },
});

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;
