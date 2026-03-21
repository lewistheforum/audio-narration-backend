import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { AccountRole } from '../../modules/accounts/enums';
import { RegistrationStatus } from '../../modules/subscriptions/enums/subscription-status.enum';
import { ALLOW_EXPIRED_SUBSCRIPTION_KEY } from '../decorators/allow-expired-subscription.decorator';

/**
 * Guard to enforce subscription-based access control for clinic-related roles.
 * - Blocks all clinic-related roles if the clinic's subscription is EXPIRED.
 * - Allows CLINIC_ADMIN to access specific endpoints marked with @AllowExpiredSubscription()
 *   even when the subscription is EXPIRED, so they can perform renewals/payments.
 */
@Injectable()
export class ClinicSubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accountsService: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only apply to clinic-related roles
    const clinicRoles = [
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.CLINIC_STAFF,
      AccountRole.DOCTOR,
    ];

    if (!user || !clinicRoles.includes(user.role)) {
      return true;
    }

    // Resolve the clinic admin ID (owner of the subscription)
    const clinicAdminId = await this.accountsService.resolveClinicAdminId(user);

    // Check subscription status
    const subscription = await this.accountsService.getClinicSubscription(clinicAdminId);
    
    if (!subscription) {
      // No subscription record found
      return true; // Or throw depending on system policy. Existing logic suggests allowing or handling elsewhere.
    }

    if (subscription.subscriptionStatus === RegistrationStatus.EXPIRED) {
      // Check if the endpoint is specifically allowed for expired subscriptions
      const isAllowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_EXPIRED_SUBSCRIPTION_KEY,
        [context.getHandler(), context.getClass()],
      );

      // Only CLINIC_ADMIN is allowed to use bypass endpoints
      if (isAllowed && user.role === AccountRole.CLINIC_ADMIN) {
        return true;
      }

      throw new ForbiddenException(
        'Subscription expired. Please contact your clinic administrator to renew.',
      );
    }

    return true;
  }
}
