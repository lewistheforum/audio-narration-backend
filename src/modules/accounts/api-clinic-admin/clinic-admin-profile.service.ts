import { Injectable, NotFoundException } from '@nestjs/common';
import { 
  ClinicAdminInformationRepository,
  AccountRepository,
} from '../repositories';
import { 
  UpdateClinicAdminOwnProfileDto,
  AccountResponseDto 
} from '../dto';
import { AccountsService } from '../accounts.service';

/**
 * Clinic Admin Profile Service
 * 
 * Handles all profile-related operations for clinic administrators.
 * This service is separate from the main AccountsService to provide
 * better isolation for clinic admin specific logic.
 */
@Injectable()
export class ClinicAdminProfileService {
  constructor(
    private readonly clinicAdminInfoRepository: ClinicAdminInformationRepository,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Update Clinic Admin Own Profile
   * 
   * Updates detailed clinic admin information for the authenticated admin.
   * Covers all fields in the clinic_admin_information entity.
   * 
   * @param adminId Clinic admin account ID (from JWT)
   * @param dto Profile update data
   * @returns Updated account information including profile details
   */
  async updateOwnProfile(
    adminId: string,
    dto: UpdateClinicAdminOwnProfileDto,
  ): Promise<AccountResponseDto> {
    const profile = await this.clinicAdminInfoRepository.findByAccountId(adminId);

    if (!profile) {
      throw new NotFoundException('Clinic admin profile not found');
    }

    // Map DTO to entity - Only update provided fields
    if (dto.clinicName !== undefined) profile.clinicName = dto.clinicName;
    if (dto.clinicPhone !== undefined) profile.clinicPhone = dto.clinicPhone;
    if (dto.description !== undefined) profile.description = dto.description;
    if (dto.specializedIn !== undefined) profile.specializedIn = dto.specializedIn;
    if (dto.pros !== undefined) profile.pros = dto.pros;
    if (dto.paraclinical !== undefined) profile.paraclinical = dto.paraclinical;
    if (dto.dob !== undefined) profile.dob = new Date(dto.dob);
    if (dto.profilePicture !== undefined) profile.profilePicture = dto.profilePicture;
    if (dto.bankName !== undefined) profile.bankName = dto.bankName;
    if (dto.bankNumber !== undefined) profile.bankNumber = dto.bankNumber;
    if (dto.bankBranch !== undefined) profile.bankBranch = dto.bankBranch;
    if (dto.sepayVa !== undefined) profile.sepayVa = dto.sepayVa;
    if (dto.sepayKey !== undefined) profile.sepayKey = dto.sepayKey;
    if (dto.isVerify !== undefined) profile.isVerify = dto.isVerify;

    // Save changes
    await this.clinicAdminInfoRepository.save(profile);

    // Return full updated profile using the shared utility from AccountsService
    return this.accountsService.getAccountInformationByRole(adminId);
  }

  /**
   * Get Own Profile
   * 
   * Retrieves the current profile information for the authenticated clinic admin.
   * 
   * @param adminId Clinic admin account ID
   * @returns Account information including profile details
   */
  async getOwnProfile(adminId: string): Promise<AccountResponseDto> {
    return this.accountsService.getAccountInformationByRole(adminId);
  }
}
