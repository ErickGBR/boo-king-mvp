import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Decorator counterpart of `requireRole(...roles)`. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
