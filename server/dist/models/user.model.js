// Defines the User model schema and interface for MongoDB and TypeScript.
import mongoose from 'mongoose';
const userSchema = new mongoose.Schema(//uses created typing from line 4
{
    githubId: { type: String, required: true, unique: true }, // GitHub unique user ID
    username: { type: String, required: true }, // GitHub username
    avatarUrl: { type: String }, // Optional: GitHub avatar
    email: { type: String }, // Optional: public GitHub email
    accessToken: { type: String }, // (Optional) only if you want to make GitHub API requests
    installationId: { type: Number }, //(Optional) only if User has already installed github APP
    createdAt: { type: Date, default: Date.now },
    //queries: [{ type: Schema.Types.ObjectId, ref: 'Query' }],
    //Array of documents of type ObjectID, each refers to a doc in Query collection;
}, { timestamps: true } //created at + updated at, does both;
);
const User = mongoose.model('User', userSchema);
export default User;
