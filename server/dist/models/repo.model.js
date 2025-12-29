import mongoose, { Schema } from 'mongoose';
const repoSchema = new Schema({
    githubId: { type: Number, required: true },
    fullName: { type: String, required: true },
    private: { type: Boolean, required: true },
    installationId: { type: Number, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    selected: { type: Boolean, default: false },
}, { timestamps: true });
const Repo = mongoose.model('Repo', repoSchema);
export default Repo;
