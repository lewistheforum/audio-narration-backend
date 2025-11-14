import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/user/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access an endpoint
 * Usage: @Roles(UserRole.ADMIN, UserRole.DOCTOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
