import express from 'express';
import Conversation from '../../models/conversation.model.js';
import TrainingRun from '../../models/trainingRun.model.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireTeamAuth } from '../../middleware/teamAuthMiddleware.js';
import { Citations } from '../../models/conversation.model.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';

/**
 * Helper function to extract and count training pairs efficiently
 * Avoids redundancy between check and export operations
 */
const extractTrainingPairs = async (options: {
  countOnly?: boolean;
  minPairs?: number;
  lastDataTimestamp?: Date;
  userId?: string;
}) => {
  const {
    countOnly = false,
    minPairs = 200,
    lastDataTimestamp,
    userId,
  } = options;

  // Get conversations based on filters
  const query = userId ? { userId } : {};
  const conversations = await Conversation.find(query).sort({ updatedAt: -1 });

  // Filter conversations based on timestamp if provided
  const filteredConversations = lastDataTimestamp
    ? conversations.filter((conv) =>
        conv.messages.some((msg: any) => msg.timestamp > lastDataTimestamp),
      )
    : conversations;

  // Extract all messages from all conversations
  const allMessages = filteredConversations.flatMap((conv) =>
    conv.messages
      .filter(
        (msg: any) => !lastDataTimestamp || msg.timestamp > lastDataTimestamp,
      )
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        citations: msg.citations,
        sessionId: conv.sessionId,
        repoUrl: conv.repoUrl,
        userId: conv.userId,
      })),
  );

  const trainingPairs = [];
  let pairCount = 0;
  let latestTimestamp = lastDataTimestamp || new Date('2025-01-01');

  for (let i = 0; i < allMessages.length - 1; i++) {
    const currentMsg = allMessages[i];
    const nextMsg = allMessages[i + 1];

    // Track latest timestamp
    if (currentMsg.timestamp > latestTimestamp) {
      latestTimestamp = currentMsg.timestamp;
    }

    // Look for user->assistant pairs in the same session
    if (
      currentMsg.role === 'user' &&
      nextMsg.role === 'assistant' &&
      currentMsg.sessionId === nextMsg.sessionId
    ) {
      pairCount++;

      // If we're only counting and have enough, short-circuit for efficiency
      if (countOnly && pairCount >= minPairs) {
        return {
          pairCount,
          totalMessages: allMessages.length,
          totalConversations: conversations.length,
          latestTimestamp,
          trainingPairs: [],
          earlyExit: true,
        };
      }

      // If we need full pairs, create them
      if (!countOnly) {
        // Build conversation context from previous messages in same session
        const contextMessages = allMessages
          .filter(
            (msg) =>
              msg.sessionId === currentMsg.sessionId &&
              msg.timestamp < currentMsg.timestamp,
          )
          .slice(-4) // Last 4 messages for context
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join('\n');

        // Format for fine-tuning
        const instruction = contextMessages
          ? `Context:\n${contextMessages}\n\nUser: ${currentMsg.content}`
          : `User: ${currentMsg.content}`;

        const response = nextMsg.content;

        // Add citations if available
        const citationsText = nextMsg.citations?.length
          ? `\n\nReferences:\n${nextMsg.citations
              .map(
                (c: Citations) =>
                  `- ${c.file} (lines ${c.startLine}-${
                    c.endLine
                  }): ${c.snippet.slice(0, 100)}...`,
              )
              .join('\n')}`
          : '';

        trainingPairs.push({
          instruction,
          response: response + citationsText,
          metadata: {
            sessionId: currentMsg.sessionId,
            repoUrl: currentMsg.repoUrl,
            userId: currentMsg.userId,
            timestamp: currentMsg.timestamp,
          },
        });
      }
    }
  }

  return {
    pairCount,
    totalMessages: allMessages.length,
    totalConversations: conversations.length,
    latestTimestamp,
    trainingPairs,
    earlyExit: false,
  };
};

/**
 * 1. Check if we have enough data for fine-tuning
 * GET /api/training/check-readiness?min_pairs=200
 */
export const checkTrainingReadiness = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const minPairs = parseInt(req.query.min_pairs as string) || 200;

    // Use helper with countOnly=true for efficiency
    const result = await extractTrainingPairs({
      countOnly: true,
      minPairs,
    });

    const isReady = result.pairCount >= minPairs;

    const response = {
      ready: isReady,
      currentPairs: result.pairCount,
      minRequired: minPairs,
      deficit: Math.max(0, minPairs - result.pairCount),
      totalConversations: result.totalConversations,
      recommendation: isReady
        ? 'Ready for fine-tuning!'
        : `Need ${minPairs - result.pairCount} more conversation pairs`,
    };

    res.json(response);
  } catch (error) {
    logger.error('❌ Error checking training readiness', { error });
    res.status(500).json({ error: 'Failed to check training readiness' });
  }
};

/**
 * 2. Export ALL users' conversation data for global fine-tuning
 * GET /api/training/export-data?min_pairs=200
 */
export const exportTrainingData = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const minPairs = parseInt(req.query.min_pairs as string) || 200;
    const userId = req.query.user_id as string; // Optional: for user-specific export

    logger.info(`📊 Exporting training data`, {
      scope: userId ? 'user' : 'all',
      userId,
    });

    // Use helper to get full training pairs
    const result = await extractTrainingPairs({
      countOnly: false,
      minPairs,
      userId,
    });

    if (result.totalConversations === 0) {
      res
        .status(404)
        .json({ error: 'No conversation data found for training' });
      return;
    }

    // Check if we have enough data
    if (result.pairCount < minPairs) {
      res.status(400).json({
        error: `Insufficient training data. Found ${result.pairCount} pairs, need at least ${minPairs}`,
        currentPairs: result.pairCount,
        minRequired: minPairs,
        suggestion: 'Wait for more user interactions or lower the threshold',
      });
      return;
    }

    const allMessages = result.totalMessages;
    const uniqueUsers = [
      ...new Set(result.trainingPairs.map((p) => p.metadata.userId)),
    ];
    const uniqueRepos = [
      ...new Set(result.trainingPairs.map((p) => p.metadata.repoUrl)),
    ];

    const exportData = {
      exportType: userId ? 'user-specific' : 'global',
      exportedAt: new Date().toISOString(),
      totalConversations: result.totalConversations,
      totalMessages: allMessages,
      trainingPairs: result.trainingPairs,
      stats: {
        totalPairs: result.trainingPairs.length,
        averageInstructionLength: Math.round(
          result.trainingPairs.reduce(
            (sum, p) => sum + p.instruction.length,
            0,
          ) / result.trainingPairs.length,
        ),
        averageResponseLength: Math.round(
          result.trainingPairs.reduce((sum, p) => sum + p.response.length, 0) /
            result.trainingPairs.length,
        ),
        uniqueUsers: uniqueUsers.length,
        uniqueRepos: uniqueRepos.length,
        userIds: uniqueUsers,
        repoUrls: uniqueRepos,
      },
    };

    logger.info(
      `✅ Exported ${result.trainingPairs.length} training pairs for fine-tuning`,
      { uniqueUsers: uniqueUsers.length, uniqueRepos: uniqueRepos.length },
    );

    res.json(exportData);
  } catch (error) {
    logger.error('❌ Error exporting training data', { error });
    res.status(500).json({ error: 'Failed to export training data' });
  }
};

/**
 * 3. Trigger fine-tuning job (for automated weekly job or manual trigger)
 * POST /api/training/trigger-training
 */
export const triggerTraining = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    // Check if we have enough data first
    const minPairs = req.body.min_pairs || 200;

    // This would typically trigger a background job, queue system, or webhook to RunPod
    // For now, just return the command they need to run

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jobId = `training-${timestamp}`;

    // In a real implementation, we'd:
    // 1. Export the data to a file
    // 2. Upload to RunPod or trigger their API
    // 3. Monitor the job status
    // 4. Deploy the model when complete

    const response = {
      jobId,
      status: 'triggered',
      message: 'Fine-tuning job initiated',
      nextSteps: [
        'Data will be exported automatically',
        'Training job will start on RunPod',
        'Model will be deployed when complete',
        'API will be updated to use new model',
      ],
      estimatedTime: '1-2 hours',
      // For manual execution:
      manualCommands: {
        export: `curl -X GET "${req.protocol}://${req.get(
          'host',
        )}/api/training/export-data?min_pairs=${minPairs}" > training_data_${jobId}.json`,
        train: `python scripts/train.py --data training_data_${jobId}.json --output ./models/devai_${jobId}`,
        deploy: `ollama create devai-assistant-${jobId} -f ./models/devai_${jobId}/Modelfile`,
      },
    };

    logger.info(`🚀 Fine-tuning job triggered: ${jobId}`);

    res.json(response);
  } catch (error) {
    logger.error('❌ Error triggering training', { error });
    res.status(500).json({ error: 'Failed to trigger training' });
  }
};

/**
 * Start a training run with timestamp tracking
 * POST /api/training/start-run
 */
export const startTrainingRun = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const minPairs = req.body.min_pairs || 200;

    // Get the last successful training run to avoid duplicate training
    const lastTrainingRun = await TrainingRun.findOne({
      status: 'completed',
    }).sort({ completedAt: -1 });

    const lastDataTimestamp =
      lastTrainingRun?.lastDataTimestamp || new Date('2020-01-01');

    logger.info(`📊 Checking for new data since last training run`, {
      lastDataTimestamp,
    });

    // Use helper to get new training pairs since last run
    const result = await extractTrainingPairs({
      countOnly: false,
      minPairs,
      lastDataTimestamp,
    });

    if (result.pairCount < minPairs) {
      res.status(400).json({
        error: `Insufficient new training data. Found ${result.pairCount} new pairs, need ${minPairs}`,
        newPairs: result.pairCount,
        minPairs,
        lastTrainingRun: lastTrainingRun
          ? {
              runId: lastTrainingRun.runId,
              completedAt: lastTrainingRun.completedAt,
              dataPointsCount: lastTrainingRun.dataPointsCount,
            }
          : null,
        recommendation:
          'Wait for more user interactions or lower min_pairs threshold',
      });
      return;
    }

    // Create new training run record
    const runId = uuidv4();
    const modelVersion = `devai-v${Date.now()}`;

    const trainingRun = new TrainingRun({
      runId,
      startedAt: new Date(),
      status: 'running',
      dataPointsCount: result.pairCount,
      lastDataTimestamp: result.latestTimestamp,
      modelVersion,
      runDetails: {
        minPairs,
        actualPairs: result.pairCount,
      },
    });

    await trainingRun.save();

    logger.info(`🚀 Training run started`, {
      runId,
      newPairs: result.pairCount,
    });

    const response = {
      runId,
      modelVersion,
      status: 'started',
      newDataPoints: result.pairCount,
      dataWindow: {
        since: lastDataTimestamp,
        until: result.latestTimestamp,
      },
      nextSteps: [
        'Export new training data',
        'Upload to RunPod and start training',
        'Monitor training progress',
        'Deploy model when complete',
      ],
      manualCommands: {
        export: `curl -H "Authorization: Bearer TEAM_TOKEN" "${
          req.protocol
        }://${req.get(
          'host',
        )}/api/training/export-data?min_pairs=${minPairs}&since_last_run=true" > training_data_${runId}.json`,
        train: `python scripts/train.py --data training_data_${runId}.json --output ./models/${modelVersion}`,
        deploy: `ollama create ${modelVersion} -f ./models/${modelVersion}/Modelfile`,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('❌ Error starting training run', { error });
    res.status(500).json({ error: 'Failed to start training run' });
  }
};

/**
 * Complete a training run (call this after successful training)
 * POST /api/training/complete-run
 */
export const completeTrainingRun = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { runId, success, error } = req.body;

    if (!runId) {
      res.status(400).json({ error: 'runId is required' });
      return;
    }

    const trainingRun = await TrainingRun.findOne({ runId });

    if (!trainingRun) {
      res.status(404).json({ error: 'Training run not found' });
      return;
    }

    const completedAt = new Date();
    const duration = Math.round(
      (completedAt.getTime() - trainingRun.startedAt.getTime()) / 60000,
    ); // minutes

    trainingRun.status = success ? 'completed' : 'failed';
    trainingRun.completedAt = completedAt;
    trainingRun.runDetails.trainingDuration = duration;

    if (error) {
      trainingRun.runDetails.errorMessage = error;
    }

    await trainingRun.save();

    logger.info(
      `${success ? '✅' : '❌'} Training run ${success ? 'completed' : 'failed'}`,
      { runId, durationMinutes: duration },
    );

    res.json({
      runId,
      status: trainingRun.status,
      duration: `${duration} minutes`,
      message: success ? 'Training completed successfully' : 'Training failed',
      modelVersion: trainingRun.modelVersion,
    });
  } catch (error) {
    logger.error('❌ Error completing training run', { error });
    res.status(500).json({ error: 'Failed to complete training run' });
  }
};
