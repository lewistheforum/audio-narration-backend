import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { Address } from '../../modules/accounts/entities/addresses.entity';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import {
  PROVINCES,
  WARDS_D1_HCMC,
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
  private readonly WARDS = WARDS_D1_HCMC;
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

      // Get all CLINIC_MANAGER accounts only
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
        // Check if address already exists for this manager (idempotency)
        const existingAddress = await this.addressRepository.findByAccountId(
          manager._id,
        );

        if (existingAddress) {
          skippedCount++;
          continue;
        }

        // Create address with realistic Vietnamese clinic address
        const location = this.getRandomLocation();

        const address = this.addressRepository.create({
          accountId: manager._id,
          address: this.generateClinicAddress(),
          ward: location.wardCode,
          district: location.districtCode,
          province: location.provinceCode,
          provinceName: location.provinceName,
          districtName: location.districtName,
          wardName: location.wardName,
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
   * Get random cohesive location details
   */
  private getRandomLocation() {
    const province =
      this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    const district =
      province.districts[Math.floor(Math.random() * province.districts.length)];
    const ward = this.WARDS[Math.floor(Math.random() * this.WARDS.length)];

    return {
      provinceCode: String(province.code),
      provinceName: province.name,
      districtCode: String(district.code),
      districtName: district.name,
      wardCode: String(ward.code),
      wardName: ward.name,
    };
  }
}
