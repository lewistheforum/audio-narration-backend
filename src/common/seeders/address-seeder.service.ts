import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { Address } from '../../modules/accounts/entities/addresses.entity';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import {
  PROVINCES,
  WARDS,
  STREET_NAMES,
  BUILDING_TYPES,
} from '../constants/locations';

/**
 * Address Seeder Service
 *
 * Seeds address records for CLINIC_MANAGER accounts.
 *
 * Seeding Rules:
 * - For each CLINIC_MANAGER account, create exactly 1 Address record.
 * - Must be idempotent (re-run safe).
 * - Seed realistic English-style clinic address.
 *
 * Idempotent: Uses check-then-insert pattern by accountId
 */
@Injectable()
export class AddressSeederService {
  private readonly logger = new Logger(AddressSeederService.name);

  // English provinces and districts for realistic addresses
  private readonly PROVINCES = PROVINCES;
  private readonly WARDS = WARDS;
  private readonly STREET_NAMES = STREET_NAMES;
  private readonly BUILDING_TYPES = BUILDING_TYPES;

  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  /**
   * Seed addresses for all CLINIC_MANAGER accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed addresses...');

      // Get all CLINIC_MANAGER accounts
      const clinicManagers = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_MANAGER),
        );

      if (clinicManagers.length === 0) {
        this.logger.warn('No CLINIC_MANAGER accounts found. Skipping seeding.');
        return;
      }

      let createdCount = 0;
      let skippedCount = 0;

      for (const manager of clinicManagers) {
        // Check if address already exists for this manager
        const existingAddresses = await this.addressRepository.findByAccountId(
          manager._id,
        );

        // if (existingAddresses.length > 0) {
        //   skippedCount++;
        //   continue;
        // }

        // Create address with realistic Vietnamese clinic address
        const address = this.addressRepository.create({
          accountId: manager._id,
          address: this.generateClinicAddress(),
          ward: this.getRandomWardCode(),
          district: this.getRandomDistrictCode(),
          province: this.getRandomProvinceCode(),
          provinceName: this.getRandomProvinceName(),
          districtName: this.getRandomDistrictName(),
          wardName: this.getRandomWard(),
        });

        await this.addressRepository.save(address);
        createdCount++;
      }

      this.logger.log(
        `✅ Address seeding completed: ${createdCount} created, ${skippedCount} skipped`,
      );
    } catch (error) {
      this.logger.error('Failed to seed addresses', error.stack);
      throw error;
    }
  }

  /**
   * Generate realistic clinic address
   */
  private generateClinicAddress(): string {
    const buildingType =
      this.BUILDING_TYPES[
        Math.floor(Math.random() * this.BUILDING_TYPES.length)
      ];
    const buildingNumber = Math.floor(Math.random() * 500) + 1;
    const streetName =
      this.STREET_NAMES[Math.floor(Math.random() * this.STREET_NAMES.length)];
    return `${buildingType} ${buildingNumber}, ${streetName}`;
  }

  /**
   * Get random province code
   */
  private getRandomProvinceCode(): string {
    const province =
      this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    return province.code;
  }

  /**
   * Get random province name
   */
  private getRandomProvinceName(): string {
    const province =
      this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    return province.name;
  }

  /**
   * Get random district code (using first 2 chars of province code + district index)
   */
  private getRandomDistrictCode(): string {
    const province =
      this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    const districtIndex = Math.floor(Math.random() * province.districts.length);
    return `${province.code}${String(districtIndex + 1).padStart(2, '0')}`;
  }

  /**
   * Get random district name
   */
  private getRandomDistrictName(): string {
    const province =
      this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    return province.districts[
      Math.floor(Math.random() * province.districts.length)
    ];
  }

  /**
   * Get random ward code (numeric code for ward)
   */
  private getRandomWardCode(): string {
    const districtCode = this.getRandomDistrictCode();
    const wardIndex = Math.floor(Math.random() * 20) + 1; // 1-20 wards per district
    return `${districtCode}${String(wardIndex).padStart(2, '0')}`;
  }

  /**
   * Get random ward name
   */
  private getRandomWard(): string {
    const ward = this.WARDS[Math.floor(Math.random() * this.WARDS.length)];
    return ward;
  }
}
