import request from 'supertest';
import type { Server } from 'http';
import { DEFAULT_PASSWORD } from './db';

export type HttpServer = Server;

/** `Authorization: Bearer <token>` header, the transport the SPA uses. */
export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export interface TestUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

/** Registers a user through the public API and returns its token + user. */
export async function registerAndToken(
  http: HttpServer,
  {
    name = 'Owner',
    email,
    password = DEFAULT_PASSWORD,
  }: { name?: string; email: string; password?: string },
): Promise<{ token: string; user: TestUser }> {
  const res = await request(http)
    .post('/api/auth/register')
    .send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`register fixture failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

/** Logs in through the public API and returns the bearer token. */
export async function loginToken(
  http: HttpServer,
  email: string,
  password: string = DEFAULT_PASSWORD,
): Promise<string> {
  const res = await request(http).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login fixture failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}
