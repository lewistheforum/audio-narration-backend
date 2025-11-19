import { PartialType } from '@nestjs/swagger';
import { CreateProfileDto } from './create-profile.dto';

/**
 * Update Profile DTO
 * 
 * Extends CreateProfileDto with all fields optional
 * Used for updating existing profile information
 * 
 * All fields from CreateProfileDto are available but optional
 * Only provided fields will be updated
 */
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
