import { Injectable, Logger } from '@nestjs/common';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { GoogleIframeRepository } from '../../modules/accounts/repositories/google-iframe.repository';
import { CLINIC_LOCATIONS } from '../constants/locations';

/**
 * Address Seeder Service
 *
 * Seeds address records for CLINIC_MANAGER, DOCTOR, and CLINIC_STAFF accounts.
 * Implements Address Inheritance: Doctors and Staff inherit address from their parent CLINIC_MANAGER.
 *
 * Seeding Rules:
 * - CLINIC_MANAGER: Uses predefined CLINIC_LOCATIONS (7 real addresses)
 * - DOCTOR: Inherits address from parent CLINIC_MANAGER
 * - CLINIC_STAFF: Inherits address from parent CLINIC_MANAGER
 *
 * Idempotent: Uses check-then-insert pattern by accountId
 */
@Injectable()
export class AddressSeederService {
  private readonly logger = new Logger(AddressSeederService.name);

  private readonly CLINIC_LOCATIONS = CLINIC_LOCATIONS;

  private readonly MANAGER_ADDRESS_MAPPING: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 0,
    8: 1,
    9: 2,
  };

  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly accountRepository: AccountRepository,
    private readonly googleIframeRepository: GoogleIframeRepository,
  ) {}

  /**
   * Seed addresses for all CLINIC_MANAGER, DOCTOR, and CLINIC_STAFF accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed addresses...');

      const clinicManagers = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_MANAGER),
        );

      const doctors = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.DOCTOR),
        );

      const clinicStaff = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.CLINIC_STAFF),
        );

      this.logger.log(
        `Found ${clinicManagers.length} CLINIC_MANAGER, ${doctors.length} DOCTOR, ${clinicStaff.length} CLINIC_STAFF accounts`,
      );

      let managersCreated = 0;
      let doctorsCreated = 0;
      let staffCreated = 0;
      let skippedCount = 0;

      for (const manager of clinicManagers) {
        const result = await this.seedManagerAddress(manager, managersCreated);
        if (result.created) {
          managersCreated++;
        } else if (result.skipped) {
          skippedCount++;
        }
      }

      for (const doctor of doctors) {
        const parentManager = clinicManagers.find(
          (m) => m._id === doctor.parentId,
        );
        if (!parentManager) {
          this.logger.warn(
            `Doctor ${doctor.email} has no parent CLINIC_MANAGER, skipping`,
          );
          continue;
        }

        const result = await this.seedDoctorStaffAddress(
          doctor,
          parentManager,
          'DOCTOR',
        );
        if (result.created) {
          doctorsCreated++;
        } else if (result.skipped) {
          skippedCount++;
        }
      }

      for (const staff of clinicStaff) {
        const parentManager = clinicManagers.find(
          (m) => m._id === staff.parentId,
        );
        if (!parentManager) {
          this.logger.warn(
            `Staff ${staff.email} has no parent CLINIC_MANAGER, skipping`,
          );
          continue;
        }

        const result = await this.seedDoctorStaffAddress(
          staff,
          parentManager,
          'CLINIC_STAFF',
        );
        if (result.created) {
          staffCreated++;
        } else if (result.skipped) {
          skippedCount++;
        }
      }

      this.logger.log(
        `✅ Address seeding completed: ${managersCreated} managers, ${doctorsCreated} doctors, ${staffCreated} staff created, ${skippedCount} skipped`,
      );
    } catch (error) {
      this.logger.error('Failed to seed addresses', error.stack);
      throw error;
    }
  }

  /**
   * Seed address for CLINIC_MANAGER using predefined CLINIC_LOCATIONS
   */
  private async seedManagerAddress(
    manager: any,
    managerIndex: number,
  ): Promise<{ created: boolean; skipped: boolean }> {
    const existingAddress = await this.addressRepository.findByAccountId(
      manager._id,
    );

    if (existingAddress) {
      return { created: false, skipped: true };
    }

    const locationIndex =
      this.MANAGER_ADDRESS_MAPPING[managerIndex] ?? managerIndex % 7;
    const location = this.CLINIC_LOCATIONS[locationIndex];

    const address = this.addressRepository.create({
      accountId: manager._id,
      address: location.address,
      ward: location.wardCode,
      district: location.districtCode,
      province: location.provinceCode,
      provinceName: location.province,
      districtName: location.district,
      wardName: location.ward,
    });

    const savedAddress = await this.addressRepository.save(address);

    const googleIframe = this.googleIframeRepository.create({
      addressId: savedAddress._id,
      location: location.address,
      zoomLevel: 14,
      responsive: true,
      googleMapIframe: location.googleIframe,
    });

    await this.googleIframeRepository.save(googleIframe);

    return { created: true, skipped: false };
  }

  /**
   * Seed address for DOCTOR or CLINIC_STAFF by inheriting from parent CLINIC_MANAGER
   */
  private async seedDoctorStaffAddress(
    account: any,
    parentManager: any,
    role: string,
  ): Promise<{ created: boolean; skipped: boolean }> {
    const existingAddress = await this.addressRepository.findByAccountId(
      account._id,
    );

    if (existingAddress) {
      return { created: false, skipped: true };
    }

    const parentAddress = await this.addressRepository.findByAccountId(
      parentManager._id,
    );

    if (!parentAddress) {
      this.logger.warn(
        `Parent CLINIC_MANAGER ${parentManager.email} has no address, cannot inherit for ${role} ${account.email}`,
      );
      return { created: false, skipped: true };
    }

    const parentIframe =
      await this.googleIframeRepository.existsByAddressId(parentAddress._id);

    let iframeData = null;
    const parentIframeEntity = await this.googleIframeRepository.findByAddressId(
      parentAddress._id,
    );

    if (parentIframeEntity) {
      iframeData = parentIframeEntity;
    }

    const address = this.addressRepository.create({
      accountId: account._id,
      address: parentAddress.address,
      ward: parentAddress.ward,
      district: parentAddress.district,
      province: parentAddress.province,
      provinceName: parentAddress.provinceName,
      districtName: parentAddress.districtName,
      wardName: parentAddress.wardName,
    });

    const savedAddress = await this.addressRepository.save(address);

    if (iframeData) {
      const googleIframe = this.googleIframeRepository.create({
        addressId: savedAddress._id,
        location: iframeData.location,
        zoomLevel: iframeData.zoomLevel,
        responsive: iframeData.responsive,
        googleMapIframe: iframeData.googleMapIframe,
      });

      await this.googleIframeRepository.save(googleIframe);
    }

    return { created: true, skipped: false };
  }
}