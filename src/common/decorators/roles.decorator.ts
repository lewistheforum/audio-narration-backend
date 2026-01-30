import { SetMetadata } from '@nestjs/common';
import { AccountRole } from '../../modules/accounts/enums';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access an endpoint
 * Usage: @Roles(AccountRole.ADMIN, AccountRole.DOCTOR)
 */
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);
