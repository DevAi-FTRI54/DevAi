import User from '../../../models/user.model.js';
export const findOrCreateUser = async (githubData, accessToken) => {
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
    }
    else {
        user.accessToken = accessToken;
        await user.save();
        console.log('✅ User found:', user.username);
    }
    return user;
};
