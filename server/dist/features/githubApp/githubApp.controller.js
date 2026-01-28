import User from '../../models/user.model.js';
import { logger } from '../../utils/logger.js';
import { FRONTEND_BASE_URL } from '../../config/env.validation.js';
export const saveInstallationId = async (req, res) => {
    try {
        const installationId = req.query.installation_id;
        const userId = req.user?.userId;
        if (!installationId || !userId) {
            res
                .status(400)
                .json({ error: 'Missing installation ID or user not authenticated' });
            return;
        }
        await User.findByIdAndUpdate(userId, {
            installationId: Number(installationId),
        });
        res.redirect(`${FRONTEND_BASE_URL}/dashboard`);
    }
    catch (err) {
        logger.error('Failed to save installation ID', { err });
        res.status(500).json({ error: 'Internal server error' });
    }
};
