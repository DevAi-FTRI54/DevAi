import mongoose, { Schema } from 'mongoose';

export interface ITrainingRun {
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  dataPointsCount: number;
  lastDataTimestamp: Date; // Latest message timestamp included in this run
  modelVersion: string;
  runDetails: {
    minPairs: number;
    actualPairs: number;
    trainingDuration?: number; // in minutes
    errorMessage?: string;
  };
}

const trainingRunSchema = new Schema<ITrainingRun>(
  {
    runId: { type: String, required: true, unique: true },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      required: true,
      default: 'running',
    },
    dataPointsCount: { type: Number, required: true },
    lastDataTimestamp: { type: Date, required: true },
    modelVersion: { type: String, required: true },
    runDetails: {
      minPairs: { type: Number, required: true },
      actualPairs: { type: Number, required: true },
      trainingDuration: { type: Number },
      errorMessage: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

const TrainingRun = mongoose.model<ITrainingRun>(
  'TrainingRun',
  trainingRunSchema
);
export default TrainingRun;
