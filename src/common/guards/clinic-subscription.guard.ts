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
 * Guard to enforce Hierarchical Subscription Blocking for clinic-related roles.
 *
 * Business Rule: If the root CLINIC_ADMIN's subscription is expired, inactive,
 * or missing, ALL subordinate accounts (CLINIC_MANAGER, STAFF, DOCTOR) MUST
 * be BLOCKED from accessing protected routes.
 *
 * Hierarchy Resolution:
 * - CLINIC_ADMIN: Direct subscription check
 * - CLINIC_MANAGER: Parent CLINIC_ADMIN subscription
 * - CLINIC_STAFF/DOCTOR: Grandparent CLINIC_ADMIN subscription
 *
 * Blocking Conditions:
 * - No subscription record exists
 * - Subscription status is EXPIRED
 * - Subscription status is PENDING_* (not fully active)
 * - Expiration date has passed
 *
 * Bypass:
 * - CLINIC_ADMIN can access endpoints marked with @AllowExpiredSubscription()
 *   even when subscription is expired (for renewal/payment flows)
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

    // Bypass non-clinic roles (PATIENT, ADMIN, SYSTEM_ADMIN, etc.)
    const clinicRoles = [
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.CLINIC_STAFF,
      AccountRole.DOCTOR,
    ];

    if (!user || !clinicRoles.includes(user.role)) {
      return true;
    }

    // Resolve the root CLINIC_ADMIN ID via hierarchical lookup
    const clinicAdminId = await this.accountsService.resolveClinicAdminId(user);

    // Retrieve the subscription for the root clinic admin
    const subscription = await this.accountsService.getClinicSubscription(clinicAdminId);

    // Block if no subscription record exists
    if (!subscription) {
      throw new ForbiddenException(
        'The clinic\'s subscription has expired. Please contact the clinic administrator to renew the plan.',
      );
    }

    // Check if subscription is active or in non-renewing grace period
    const isActive = subscription.subscriptionStatus === RegistrationStatus.ACTIVE;
    const isNonRenewing = subscription.subscriptionStatus === RegistrationStatus.NON_RENEWING;
    const isSubscriptionValid = isActive || isNonRenewing;

    // Check if expiration date is still valid
    const now = new Date();
    const isExpirationValid = subscription.expirationDate > now;

    // If subscription is NOT valid or has expired
    if (!isSubscriptionValid || !isExpirationValid) {
      // Check if endpoint allows expired subscription access
      const isAllowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_EXPIRED_SUBSCRIPTION_KEY,
        [context.getHandler(), context.getClass()],
      );

      // Only CLINIC_ADMIN can bypass for renewal/payment flows
      if (isAllowed && user.role === AccountRole.CLINIC_ADMIN) {
        return true;
      }

      throw new ForbiddenException(
        'The clinic\'s subscription has expired. Please contact the clinic administrator to renew the plan.',
      );
    }

    return true;
  }
}
