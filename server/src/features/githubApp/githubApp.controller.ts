import { Request, Response } from 'express';
import User from '../../models/user.model.js';

export const saveInstallationId = async (req: Request, res: Response) => {
  try {
    const installationId = req.query.installation_id;
    const userId = (req as any).user?.userId;

    if (!installationId || !userId) {
      res
        .status(400)
        .json({ error: 'Missing installation ID or user not authenticated' });
      return;
    }

    await User.findByIdAndUpdate(userId, {
      installationId: Number(installationId),
    });

    res.redirect('http://localhost:3000/dashboard'); // Needs to change!!
  } catch (err) {
    console.error('Failed to save installation ID:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
