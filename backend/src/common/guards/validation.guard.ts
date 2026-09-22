import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ValidationChain } from 'express-validator';
import { runValidation, ValidationErrorOptions } from '../validation/run-validation';

/**
 * Runs an `express-validator` chain as a guard.
 *
 * Guard order matters and is part of the behavioral contract (§1 of the design
 * doc): for example `requireRole` → `verifyBusinessOwnership` → validation on
 * the staff routes, and — in every route where validation fails *inside* the
 * handler after an inline check — that check runs first. Callers list their
 * guards in the exact order the Express middleware array had them.
 *
 * Guards are instantiated with `new ValidationGuard(chains[, options])` because
 * they carry no DI dependencies; Nest supports guard instances in `@UseGuards`.
 */
@Injectable()
export class ValidationGuard implements CanActivate {
  constructor(
    private readonly chains: ValidationChain[],
    private readonly onError?: ValidationErrorOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    await runValidation(req, this.chains, this.onError);
    return true;
  }
}
