import Conversation from '../../models/conversation.model.js';
export const askController = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const { url: repoUrl, prompt: question, type, sessionId } = req.body;
        const userId = req.user?.userId;
        res.write(`data: ${JSON.stringify({
            type: 'status',
            message: 'Retrieving code...',
        })}\n\n`);
        const { answerQuestion } = await import('./rag.service.js');
        const response = await answerQuestion(repoUrl, question, type, sessionId);
        const answer = String(response.result.response.answer);
        const citations = response.result.response.citations;
        const chunkSize = 5;
        const words = answer.split(' ');
        for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            res.write(`data: ${JSON.stringify({ type: 'answer_chunk', content: chunk })}\n\n`);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        res.write(`data: ${JSON.stringify({
            type: 'citations',
            data: citations,
            question: question,
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        await Conversation.updateOne({
            sessionId,
            repoUrl,
            userId,
        }, {
            $push: {
                messages: [
                    { role: 'user', content: question, timestamp: new Date() },
                    {
                        role: 'assistant',
                        content: answer,
                        citations,
                        timestamp: new Date(),
                    },
                ],
            },
            $setOnInsert: {
                repoUrl,
                userId,
                sessionId,
            },
        }, { upsert: true });
        res.end();
    }
    catch (err) {
        console.log('--- Error inside askController ------------');
        console.error(err);
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
    }
};
// if (err instanceof OpenAIError) {
//   res
//     .status(502)
//     .json({ message: 'askController: LLM failed', detail: err.message });
// }
// if (err.message === 'VECTOR_DB_DOWN') {
//   res.status(503).json({ msg: 'askController: Vector store unavailable' });
// } else {
//   res
//     .status(500)
//     .json({ message: 'askController: Unexpected server error' });
// }
export const addMessage = async (req, res) => {
    const { sessionId, role, content, repoUrl } = req.body;
    const userId = req.user?.userId;
    try {
        await Conversation.updateOne({
            sessionId,
            repoUrl,
            userId,
        }, {
            $push: {
                messages: [
                    {
                        role,
                        content,
                        timestamp: new Date(),
                    },
                ],
            },
            $setOnInsert: {
                repoUrl,
                userId,
                sessionId,
            },
        }, { upsert: true });
        res.json({ success: true });
    }
    catch (err) {
        console.log('--- Error inside addMessage controller ------------');
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
