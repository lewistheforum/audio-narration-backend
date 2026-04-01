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

/**
 * Guard to enforce Hierarchical Subscription Blocking for clinic-related roles.
 *
 * Business Rule:
 * - CLINIC_ADMIN can continue into the system when the clinic subscription is
 *   expired so they can complete renewal/payment flows.
 * - CLINIC_MANAGER, CLINIC_STAFF, and DOCTOR remain blocked when the root
 *   clinic subscription is expired, inactive, or missing.
 * - CLINIC_ADMIN is still blocked while clinic onboarding is incomplete.
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

    const now = new Date();
    const isActive = subscription.subscriptionStatus === RegistrationStatus.ACTIVE;
    const isNonRenewing =
      subscription.subscriptionStatus === RegistrationStatus.NON_RENEWING;
    const isExpired = subscription.subscriptionStatus === RegistrationStatus.EXPIRED;
    const isExpirationValid = subscription.expirationDate > now;

    if (user.role === AccountRole.CLINIC_ADMIN) {
      const isPendingOnboarding = !isActive && !isNonRenewing && !isExpired;

      if (isPendingOnboarding) {
        throw new ForbiddenException(
          'Clinic onboarding is not complete yet. Please finish the setup process before accessing the system.',
        );
      }

      return true;
    }

    const isSubscriptionValid = isActive || isNonRenewing;

    if (!isSubscriptionValid || !isExpirationValid) {
      throw new ForbiddenException(
        'The clinic\'s subscription has expired. Please contact the clinic administrator to renew the plan.',
      );
    }

    return true;
  }
}
