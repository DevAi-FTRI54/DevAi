import User from '../../../models/user.model.js';
import mongoose from 'mongoose';

// GitHub user profile interface
interface GitHubUserProfile {
  id: number;
  login: string;
  avatar_url: string;
  email?: string;
  [key: string]: any; // For other GitHub properties
}

// User document interface
interface UserDocument extends mongoose.Document {
  githubId: string;
  username: string;
  avatarUrl: string;
  email: string;
  accessToken: string;
}

export const findOrCreateUser = async (githubData: GitHubUserProfile, accessToken: string): Promise<UserDocument> => {
  // Check if user exists
  let user = await User.findOne({ githubId: githubData.id.toString() });

  // Create new user if not found
  if (!user) {
    user = new User({
      githubId: githubData.id.toString(),
      username: githubData.login,
      avatarUrl: githubData.avatar_url,
      email: githubData.email || `${githubData.login}@users.noreply.github.com`,
      accessToken: accessToken,
    });
    await user.save();
    console.log('✅ User created:', user.username);
  } else {
    user.accessToken = accessToken;
    await user.save();
    console.log('✅ User found:', user.username);
  }

  return user;
};
