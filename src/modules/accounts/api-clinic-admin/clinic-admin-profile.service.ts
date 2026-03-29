import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    private readonly accountRepository: AccountRepository,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Update Clinic Admin Own Profile
   * 
   * Updates detailed clinic admin information for the authenticated admin.
   * Covers all fields in the clinic_admin_information entity and core account fields.
   * 
   * @param adminId Clinic admin account ID (from JWT)
   * @param dto Profile update data
   * @returns Updated account information including profile details
   */
  async updateOwnProfile(
    adminId: string,
    dto: UpdateClinicAdminOwnProfileDto,
  ): Promise<AccountResponseDto> {
    const account = await this.accountRepository.findAccountById(adminId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const profile = await this.clinicAdminInfoRepository.findByAccountId(adminId);
    if (!profile) {
      throw new NotFoundException('Clinic admin profile not found');
    }

    // 1. Check Email Uniqueness if changing
    if (dto.email !== undefined && dto.email !== account.email) {
      const existingAccount = await this.accountRepository.findByEmail(dto.email);
      if (existingAccount && existingAccount._id !== adminId) {
        throw new ConflictException('Email is already in use by another account');
      }
      account.email = dto.email;
    }

    // 2. Check Phone if changing
    if (dto.phone !== undefined && dto.phone !== account.phone) {
      const existingAccount = await this.accountRepository.findByPhone(dto.phone);
      if (existingAccount && existingAccount._id !== adminId) {
        throw new ConflictException('Phone number is already in use');
      }
      account.phone = dto.phone;
    }

    // 3. Check SePay VA Uniqueness if changing
    if (dto.sepayVa !== undefined && dto.sepayVa !== profile.sepayVa) {
      const existingInfo = await this.clinicAdminInfoRepository.findBySepayVa(dto.sepayVa);
      if (existingInfo && existingInfo.accountId !== adminId) {
        throw new ConflictException('SePay Virtual Account is already assigned to another clinic');
      }
      profile.sepayVa = dto.sepayVa;
    }

    // 4. Check SePay Key Uniqueness if changing
    if (dto.sepayKey !== undefined && dto.sepayKey !== profile.sepayKey) {
      const existingInfo = await this.clinicAdminInfoRepository.findBySepayKey(dto.sepayKey);
      if (existingInfo && existingInfo.accountId !== adminId) {
        throw new ConflictException('SePay API Key is already in use');
      }
      profile.sepayKey = dto.sepayKey;
    }

    // Map other profile fields - Only update provided fields
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
    if (dto.isVerify !== undefined) profile.isVerify = dto.isVerify;

    // Save changes for both account and profile
    await this.accountRepository.saveAccount(account);
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
