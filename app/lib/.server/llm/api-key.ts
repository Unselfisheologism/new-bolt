import { env } from 'node:process';

export function getAPIKey() {
  /**
   * Environment variables are available through process.env on Vercel.
   */
  return process.env.POLLINATIONS_API_TOKEN;
}
