import express from 'express';
const app = express();
app.get('/api/health', (_req, res) => {
    console.log('✅ Health check hit');
    res.status(200).json({ ok: true });
});
export default app;
