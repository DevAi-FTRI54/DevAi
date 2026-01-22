/**
 * Request Validation Middleware
 * 
 * This middleware validates incoming request data before it reaches our controllers.
 * It's like having a quality checker at the door - if the data doesn't meet our standards,
 * we catch it early and return a helpful error message instead of letting bad data cause
 * problems deeper in the application.
 * 
 * We use Zod (a TypeScript-first schema validation library) to define what "good" data
 * looks like. Zod gives us:
 * - Type safety (TypeScript knows exactly what types we expect)
 * - Runtime validation (catches issues when requests come in, not later)
 * - Helpful error messages (tells us exactly what's wrong with the data)
 * - Automatic type inference (validated data is automatically typed correctly)
 * 
 * This prevents a whole class of bugs:
 * - Missing required fields
 * - Wrong data types (string instead of number, etc.)
 * - Invalid formats (malformed emails, URLs, etc.)
 * - Injection attacks (by validating and sanitizing input)
 * 
 * We have separate validators for different parts of the request:
 * - Body validation (for POST/PUT requests with JSON bodies)
 * - Query validation (for GET requests with URL parameters)
 * - Params validation (for route parameters like /users/:id)
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validate Request Body
 * 
 * This middleware validates the JSON body of POST/PUT requests. It ensures the data
 * matches our expected schema before we try to use it in controllers.
 * 
 * If validation fails, we return a 400 (Bad Request) with detailed information about
 * what's wrong. This helps API consumers fix their requests quickly.
 * 
 * @param schema - Zod schema defining what the request body should look like
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.post('/users', validateBody(userSchema), createUser);
 * ```
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate the request body against our schema
      // Zod will throw an error if validation fails
      req.body = schema.parse(req.body);
      // If validation passes, move on to the next middleware/controller
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Validation failed - return helpful error details
        res.status(400).json({
          error: 'Validation error',
          message: 'The request body does not match the expected format.',
          details: error.errors.map((err) => ({
            path: err.path.join('.'), // Which field has the problem (e.g., "email" or "user.name")
            message: err.message, // What's wrong with it (e.g., "Invalid email format")
          })),
        });
        return;
      }
      // If it's not a Zod error, something unexpected happened - pass it to error handler
      next(error);
    }
  };
}

/**
 * Validate Query Parameters
 * 
 * This middleware validates URL query parameters (the stuff after `?` in URLs).
 * Query parameters are always strings, so Zod can help us convert them to the right
 * types (numbers, booleans, etc.) and validate their formats.
 * 
 * This is especially important for things like pagination (page numbers, limits) or
 * filters (dates, status codes) where we need specific types and formats.
 * 
 * @param schema - Zod schema defining what the query parameters should look like
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.get('/users', validateQuery(paginationSchema), getUsers);
 * // GET /users?page=1&limit=10
 * ```
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate query parameters
      // Zod automatically handles type conversion (string "123" -> number 123)
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Return helpful error with details about which query params are wrong
        res.status(400).json({
          error: 'Query validation error',
          message: 'The URL query parameters are invalid.',
          details: error.errors.map((err) => ({
            path: err.path.join('.'), // Which query param (e.g., "page" or "filter.status")
            message: err.message, // What's wrong (e.g., "Expected number, received string")
          })),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate Route Parameters
 * 
 * This middleware validates route parameters (the dynamic parts of URLs like `/users/:id`).
 * Route parameters are always strings, so we use Zod to validate and convert them to
 * the right types (like converting a string ID to a number or validating it's a valid UUID).
 * 
 * This prevents issues like:
 * - Trying to use "abc" as a user ID when we expect a number
 * - Invalid UUIDs in routes that require them
 * - Missing required route parameters
 * 
 * @param schema - Zod schema defining what the route parameters should look like
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.get('/users/:id', validateParams(userIdSchema), getUser);
 * // GET /users/123 (id must be a number)
 * ```
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate route parameters
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Return helpful error about which route param is invalid
        res.status(400).json({
          error: 'Parameter validation error',
          message: 'The URL parameters are invalid.',
          details: error.errors.map((err) => ({
            path: err.path.join('.'), // Which param (e.g., "id" or "userId")
            message: err.message, // What's wrong (e.g., "Expected number, received string")
          })),
        });
        return;
      }
      next(error);
    }
  };
}

