export interface ServerError {
  log: string;
  status: number;
  message: { err: string };
  stack?: string; // Add optional stack property
  name?: string;
}
