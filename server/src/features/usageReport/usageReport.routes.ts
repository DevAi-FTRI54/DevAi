import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getUsageReport } from './usageReport.controller.js';

const router = Router();
router.get('/', requireAuth, getUsageReport);
export default router;
