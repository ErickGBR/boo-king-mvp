/**
 * Sentinel thrown by `JwtStrategy.validate` when the token is well-formed but
 * the user row no longer exists. `JwtAuthGuard.handleRequest` maps it to the
 * exact body the Express middleware produced: `401 { error: 'User not found' }`.
 */
export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}
