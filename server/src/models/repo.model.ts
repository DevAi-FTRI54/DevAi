import mongoose, { Schema, Document } from 'mongoose';

export interface IRepo extends Document {
  githubId: number;
  fullName: string;
  private: boolean;
  installationId: number;
  user: mongoose.Types.ObjectId; // references User
  selected: boolean; // optional flag
}

const repoSchema = new Schema<IRepo>(
  {
    githubId: { type: Number, required: true },
    fullName: { type: String, required: true },
    private: { type: Boolean, required: true },
    installationId: { type: Number, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    selected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Repo = mongoose.model<IRepo>('Repo', repoSchema);
export default Repo;
