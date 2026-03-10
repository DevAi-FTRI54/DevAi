import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getUsageReport, getQueryLog } from './usageReport.controller.js';
const router = Router();
router.get('/', requireAuth, getUsageReport);
router.get('/query-log', requireAuth, getQueryLog);
export default router;
