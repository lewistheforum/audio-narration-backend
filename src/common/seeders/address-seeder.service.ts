import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { Address } from '../../modules/accounts/entities/addresses.entity';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';

/**
 * Address Seeder Service
 *
 * Seeds address records for CLINIC_MANAGER accounts.
 *
 * Seeding Rules:
 * - For each CLINIC_MANAGER account, create exactly 1 Address record.
 * - Must be idempotent (re-run safe).
 * - Seed realistic Vietnamese-style clinic address.
 *
 * Idempotent: Uses check-then-insert pattern by accountId
 */
@Injectable()
export class AddressSeederService {
  private readonly logger = new Logger(AddressSeederService.name);

  // Vietnamese provinces and districts for realistic addresses
  private readonly PROVINCES = [
    { code: '01', name: 'Thành phố Hà Nội', districts: ['Ba Đình', 'Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Hoàn Kiếm', 'Hồ Tây', 'Long Biên', 'Tây Hồ', 'Thanh Xuân', 'Hoàng Mai'] },
    { code: '79', name: 'Thành phố Hồ Chí Minh', districts: ['Quận 1', 'Quận 3', 'Quận 5', 'Quận 6', 'Quận 10', 'Quận 11', 'Quận 12', 'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú'] },
    { code: '48', name: 'Thành phố Đà Nẵng', districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Cẩm Lệ', 'Ngũ Hành Sơn', 'Liên Chiểu'] },
    { code: '43', name: 'Thành phố Đà Nẵng', districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Cẩm Lệ', 'Ngũ Hành Sơn', 'Liên Chiểu'] },
    { code: '31', name: 'Thành phố Hải Phòng', districts: ['Hồng Bàng', 'Ngô Quyền', 'Lê Chân', 'Kiến An', 'Đồ Sơn', 'An Dương', 'An Lão', 'Kien Thuy', 'Thủy Nguyên', 'Tiên Lãng', 'Vĩnh Bảo'] },
    { code: '54', name: 'Thành phố Cần Thơ', districts: ['Ninh Kiều', 'Cái Răng', 'Bình Thủy', 'Ô Môn', 'Thốt Nốt'] },
  ];

  private readonly WARDS = [
    'Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5',
    'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10',
    'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15',
  'Phường 16', 'Phường 17', 'Phường 18', 'Phường 19', 'Phường 20',
  'Phường An Lợi', 'Phường An Phú', 'Phường Bến Nghé', 'Phường Bình An', 'Phường Bình Thạnh',
  'Phường Cầu Kho', 'Phường Cầu Ông Lãnh', 'Phường Đa Kao', 'Phường Hiệp Phú', 'Phường Hòa Bình',
    'Phường Hòa Thạnh', 'Phường Long Bình', 'Phường Long Trường', 'Phường Long Thượng', 'Phường Long Uyên',
    'Phường Phú Hữu', 'Phường Phú Mỹ', 'Phường Phú Thạnh', 'Phường Phú Thọ', 'Phường Phú Xuân',
    'Phường Tân An', 'Phường Tân Bình', 'Phường Tân Dân', 'Phường Tân Định', 'Phường Tân Kiên',
    'Phường Tân Phú', 'Phường Tân Thạnh', 'Phường Tân Thới', 'Phường Tân Thuận', 'Phường Thạnh Lộc',
    'Phường Thạnh Mỹ Lợi', 'Phường Thới An', 'Phường Thới Dừa', 'Phường Trương Văn Thành', 'Phường Vĩnh Lộc',
  ];

  // Orthopedics clinic street names
  private readonly STREET_NAMES = [
    'Đường Nguyễn Văn Linh',
    'Đường Lê Văn Lương',
    'Đường Nguyễn Thị Định',
    'Đường Phạm Văn Đồng',
    'Đường Huỳnh Tấn Phát',
    'Đường Lê Đức Thọ',
    'Đường Điện Biên Phủ',
    'Đường Nguyễn Văn Trỗi',
    'Đường Hoàng Văn Thụ',
    'Đường Lý Thường Kiệt',
    'Đường Lê Duẩn',
    'Đường Nguyễn Bỉnh Khiêm',
    'Đường Phạm Ngọc Thạch',
    'Đường Võ Văn Tần',
    'Đường Đặng Thùy Trâm',
    'Đường Ung Văn Khiêm',
  ];

  private readonly BUILDING_TYPES = ['Tầng', 'Lầu', 'Số nhà'];

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
      const clinicManagers = await this.accountRepository.findAllAccounts().then(
        (accounts) =>
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
        const existingAddresses =
          await this.addressRepository.findByAccountId(manager._id);

        if (existingAddresses.length > 0) {
          skippedCount++;
          continue;
        }

        // Create address with realistic Vietnamese clinic address
        const address = this.addressRepository.create({
          accountId: manager._id,
          address: this.generateClinicAddress(),
          ward: this.getRandomWard(),
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
    const buildingType = this.BUILDING_TYPES[Math.floor(Math.random() * this.BUILDING_TYPES.length)];
    const buildingNumber = Math.floor(Math.random() * 500) + 1;
    const streetName = this.STREET_NAMES[Math.floor(Math.random() * this.STREET_NAMES.length)];
    return `${buildingType} ${buildingNumber}, ${streetName}`;
  }

  /**
   * Get random province code
   */
  private getRandomProvinceCode(): string {
    const province = this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    return province.code;
  }

  /**
   * Get random province name
   */
  private getRandomProvinceName(): string {
    const province = this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    return province.name;
  }

  /**
   * Get random district code (using first 2 chars of province code + district index)
   */
  private getRandomDistrictCode(): string {
    const province = this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    const districtIndex = Math.floor(Math.random() * province.districts.length);
    return `${province.code}${String(districtIndex + 1).padStart(2, '0')}`;
  }

  /**
   * Get random district name
   */
  private getRandomDistrictName(): string {
    const province = this.PROVINCES[Math.floor(Math.random() * this.PROVINCES.length)];
    return province.districts[Math.floor(Math.random() * province.districts.length)];
  }

  /**
   * Get random ward
   */
  private getRandomWard(): string {
    const ward = this.WARDS[Math.floor(Math.random() * this.WARDS.length)];
    return ward;
  }
}
