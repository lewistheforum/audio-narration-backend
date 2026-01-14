import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { ContractType } from '../../modules/accounts/enums/contract-type.enum';
import { SalaryPaymentMethod } from '../../modules/accounts/enums/salary-payment-method.enum';
import { ClinicContractInformation } from '../../modules/accounts/entities/clinic-contract-information.entity';
import { ClinicContractInformationRepository } from '../../modules/accounts/repositories/clinic-contract-information.repository';
import { ContractPackageRepository } from '../../modules/accounts/repositories/contract-package.repository';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';

/**
 * ClinicContractInformation Seeder Service
 *
 * Seeds contract information for CLINIC_STAFF and DOCTOR accounts.
 *
 * Seeding Rules:
 * - For each CLINIC_STAFF and DOCTOR account, create 1 ClinicContractInformation record.
 * - clinic_id must equal the parentId of the staff/doctor account (FK to accounts.id).
 * - Must be idempotent (re-run safe).
 * - Seed realistic orthopedics clinic contract data.
 *
 * Idempotent: Uses check-then-insert pattern by contractId
 */
@Injectable()
export class ClinicContractInformationSeederService {
  private readonly logger = new Logger(
    ClinicContractInformationSeederService.name,
  );

  // Orthopedics clinic-specific contract data
  private readonly DOCTOR_SPECIALTIES = [
    'Chuyên khoa Cơ xương khớp',
    'Chuyên khoa Chỉnh hình',
    'Chuyên khoa Cơ xương khớp và Chỉnh hình',
    'Chuyên khoa Chấn thương Chỉnh hình',
    'Chuyên khoa Trị liệu Cơ xương khớp',
  ];

  private readonly NATIONALITIES = [
    'Việt Nam',
    'Việt Kiều',
    'Việt Hoa',
    'Việt Mỹ',
    'Việt Anh',
  ];

  private readonly CURRENT_LIVING = [
    'Thành phố Hà Nội',
    'Thành phố Hồ Chí Minh',
    'Thành phố Đà Nẵng',
    'Thành phố Hải Phòng',
    'Thành phố Cần Thơ',
  ];

  private readonly WORK_SPECIALTY_AT_CLINIC = [
    'Bác sĩ điều trị cơ xương khớp',
    'Bác sĩ phẫu thuật chỉnh hình',
    'Bác sĩ trị liệu cơ xương khớp',
    'Bác sĩ chuyên khoa chấn thương chỉnh hình',
  ];

  private readonly JOB_DESCRIPTIONS = [
    'Thực hiện khám và điều trị các bệnh lý về cơ xương khớp cho bệnh nhân',
    'Phẫu thuật chỉnh hình các dị tật bẩm sinh và chấn thương',
    'Tư vấn và điều trị phục hồi chức năng sau phẫu thuật',
    'Thực hiện các xét nghiệm và chẩn đoán hình ảnh cơ xương khớp',
  ];

  private readonly REST_POLICIES = [
    'Nghỉ 1 ngày mỗi tuần, nghỉ 2 ngày mỗi tháng, nghỉ 12 ngày mỗi năm',
    'Nghỉ 2 ngày mỗi tuần, nghỉ 3 ngày mỗi tháng, nghỉ 14 ngày mỗi năm',
    'Nghỉ 1 ngày mỗi tuần, nghỉ 2 ngày mỗi tháng, nghỉ 12 ngày mỗi năm, cộng ngày nghỉ lễ tết',
  ];

  private readonly LEAVE_POLICIES = [
    'Nghỉ ốm: Có chế độ bảo hiểm xã hội, nghỉ ốm có hưởng lương',
    'Nghỉ thai sản: 6 tháng, hưởng 100% lương',
    'Nghỉ thai sản: 4 tháng, hưởng 75% lương',
  ];

  private readonly ALLOWANCES = [
    'Phụ cấp: 500,000 VND/tháng',
    'Đi lại: 300,000 VND/tháng',
    'Ăn trưa: 1,000,000 VND/tháng',
    'Điện thoại: 200,000 VND/tháng',
  ];

  private readonly PERFORMANCE_BONUSES = [
    'Thưởng đạt chỉ tiêu khám bệnh: 10% lương cơ bản',
    'Thưởng đánh giá 5S: 5% lương cơ bản',
    'Thưởng không nghỉ việc: 3% lương cơ bản',
    'Thưởng chuyên môn: 8% lương cơ bản',
  ];

  private readonly SALARY_PAYMENT_CYCLES = [
    'Thanh toán lương vào ngày 10 hàng tháng',
    'Thanh toán lương vào ngày 25 hàng tháng',
    'Thanh toán lương vào ngày cuối tháng',
  ];

  private readonly PARTY_A_SIGNERS = [
    'Bác sĩ Nguyễn Văn An - Giám đốc Phòng khám',
    'Bác sĩ Trần Thị Mai - Quản lý Phòng khám',
    'Bác sĩ Lê Văn Cường - Trưởng phòng Cơ xương khớp',
  ];

  private readonly PARTY_B_SIGNERS = [
    'Nguyễn Văn Bình - Bác sĩ',
    'Trần Thị Lan - Y tá',
    'Lê Văn Đức - Bác sĩ',
  ];

  constructor(
    private readonly clinicContractInformationRepository: ClinicContractInformationRepository,
    private readonly contractPackageRepository: ContractPackageRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  /**
   * Seed clinic contract information for CLINIC_STAFF and DOCTOR accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic contract information...');

      // Get all CLINIC_STAFF and DOCTOR accounts
      const staffAndDoctors = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter(
            (acc) =>
              acc.role === AccountRole.CLINIC_STAFF ||
              acc.role === AccountRole.DOCTOR,
          ),
        );

      if (staffAndDoctors.length === 0) {
        this.logger.warn(
          'No CLINIC_STAFF or DOCTOR accounts found. Skipping seeding.',
        );
        return;
      }

      let createdCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const employee of staffAndDoctors) {
        // Validate that employee has a parent (clinic manager)
        if (!employee.parentId) {
          this.logger.warn(
            `Account ${employee.username} (${employee.role}) has no parentId. Skipping contract information creation.`,
          );
          errorCount++;
          continue;
        }

        // Verify that parent account exists
        const parentAccount = await this.accountRepository.findAccountById(
          employee.parentId,
        );
        if (!parentAccount) {
          this.logger.warn(
            `Parent account not found for ${employee.username}. Skipping contract information creation.`,
          );
          errorCount++;
          continue;
        }

        // Find existing contract package for this employee
        const contractPackage =
          await this.contractPackageRepository.findByClinicAndEmployee(
            employee.parentId,
            employee._id,
          );

        if (!contractPackage) {
          this.logger.warn(
            `No ContractPackage found for ${employee.username}. Skipping contract information creation.`,
          );
          errorCount++;
          continue;
        }

        // Check if clinic contract information already exists for this contract
        const existing =
          await this.clinicContractInformationRepository.existsByContractId(
            contractPackage._id,
          );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Create clinic contract information with realistic orthopedics clinic data
        const contractInfo = this.clinicContractInformationRepository.create({
          contractId: contractPackage._id,
          doctorSpecialty: this.getRandomDoctorSpecialty(),
          nationality: this.getRandomNationality(),
          currentLiving: this.getRandomCurrentLiving(),
          workSpecialtyAtClinic: this.getRandomWorkSpecialtyAtClinic(),
          contractStartDate: this.getRandomContractStartDate(),
          contractEndDate: this.getRandomContractEndDate(),
          contractType: this.getRandomContractType(),
          jobDescription: this.getRandomJobDescription(),
          workingTime: this.getRandomWorkingTime(),
          restPolicy: this.getRandomRestPolicy(),
          leavePolicy: this.getRandomLeavePolicy(),
          baseSalary: this.getRandomBaseSalary(),
          allowances: this.getRandomAllowances(),
          performanceBonus: this.getRandomPerformanceBonus(),
          salaryPaymentMethod: this.getRandomSalaryPaymentMethod(),
          salaryPaymentCycle: this.getRandomSalaryPaymentCycle(),
          effectiveFrom: this.getRandomEffectiveFrom(),
          effectiveTo: this.getRandomEffectiveTo(),
          partyASignerName: this.getRandomPartyASignerName(),
          partyBSignerName: this.getRandomPartyBSignerName(),
        });

        await this.clinicContractInformationRepository.save(contractInfo);
        createdCount++;
      }

      this.logger.log(
        `✅ ClinicContractInformation seeding completed: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to seed clinic contract information',
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get random doctor specialty
   */
  private getRandomDoctorSpecialty(): string {
    return this.DOCTOR_SPECIALTIES[
      Math.floor(Math.random() * this.DOCTOR_SPECIALTIES.length)
    ];
  }

  /**
   * Get random nationality
   */
  private getRandomNationality(): string {
    return this.NATIONALITIES[
      Math.floor(Math.random() * this.NATIONALITIES.length)
    ];
  }

  /**
   * Get random current living
   */
  private getRandomCurrentLiving(): string {
    return this.CURRENT_LIVING[
      Math.floor(Math.random() * this.CURRENT_LIVING.length)
    ];
  }

  /**
   * Get random work specialty at clinic
   */
  private getRandomWorkSpecialtyAtClinic(): string {
    return this.WORK_SPECIALTY_AT_CLINIC[
      Math.floor(Math.random() * this.WORK_SPECIALTY_AT_CLINIC.length)
    ];
  }

  /**
   * Get random contract start date (within last 6 months)
   */
  private getRandomContractStartDate(): Date {
    const now = new Date();
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 6,
      now.getDate(),
    );
    const randomTime =
      sixMonthsAgo.getTime() +
      Math.random() * (now.getTime() - sixMonthsAgo.getTime());
    return new Date(randomTime);
  }

  /**
   * Get random contract end date (1-2 years after start date)
   */
  private getRandomContractEndDate(): Date {
    const startDate = this.getRandomContractStartDate();
    const monthsToAdd = 12 + Math.floor(Math.random() * 12); // 12-24 months
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + monthsToAdd,
      startDate.getDate(),
    );
    return endDate;
  }

  /**
   * Get random contract type
   */
  private getRandomContractType(): ContractType {
    const types = Object.values(ContractType);
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Get random job description
   */
  private getRandomJobDescription(): string {
    return this.JOB_DESCRIPTIONS[
      Math.floor(Math.random() * this.JOB_DESCRIPTIONS.length)
    ];
  }

  /**
   * Get random working time (8:00 AM - 5:00 PM range)
   */
  private getRandomWorkingTime(): Date {
    const hour = 8 + Math.floor(Math.random() * 9); // 8-16 hours
    const minute = Math.floor(Math.random() * 60);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }

  /**
   * Get random rest policy
   */
  private getRandomRestPolicy(): string {
    return this.REST_POLICIES[
      Math.floor(Math.random() * this.REST_POLICIES.length)
    ];
  }

  /**
   * Get random leave policy
   */
  private getRandomLeavePolicy(): string {
    return this.LEAVE_POLICIES[
      Math.floor(Math.random() * this.LEAVE_POLICIES.length)
    ];
  }

  /**
   * Get random base salary (10,000,000 - 50,000,000 VND)
   */
  private getRandomBaseSalary(): number {
    const salary = 10000000 + Math.floor(Math.random() * 40000000); // 10M-50M VND
    return salary;
  }

  /**
   * Get random allowances
   */
  private getRandomAllowances(): string {
    const allowances = [];
    const numAllowances = 1 + Math.floor(Math.random() * 3); // 1-3 allowances
    for (let i = 0; i < numAllowances; i++) {
      allowances.push(
        this.ALLOWANCES[Math.floor(Math.random() * this.ALLOWANCES.length)],
      );
    }
    return allowances.join(', ');
  }

  /**
   * Get random performance bonus
   */
  private getRandomPerformanceBonus(): string {
    return this.PERFORMANCE_BONUSES[
      Math.floor(Math.random() * this.PERFORMANCE_BONUSES.length)
    ];
  }

  /**
   * Get random salary payment method
   */
  private getRandomSalaryPaymentMethod(): SalaryPaymentMethod {
    const methods = Object.values(SalaryPaymentMethod);
    return methods[Math.floor(Math.random() * methods.length)];
  }

  /**
   * Get random salary payment cycle
   */
  private getRandomSalaryPaymentCycle(): string {
    return this.SALARY_PAYMENT_CYCLES[
      Math.floor(Math.random() * this.SALARY_PAYMENT_CYCLES.length)
    ];
  }

  /**
   * Get random effective from date (same as contract start date)
   */
  private getRandomEffectiveFrom(): Date {
    return this.getRandomContractStartDate();
  }

  /**
   * Get random effective to date (same as contract end date)
   */
  private getRandomEffectiveTo(): Date {
    return this.getRandomContractEndDate();
  }

  /**
   * Get random party A signer name
   */
  private getRandomPartyASignerName(): string {
    return this.PARTY_A_SIGNERS[
      Math.floor(Math.random() * this.PARTY_A_SIGNERS.length)
    ];
  }

  /**
   * Get random party B signer name
   */
  private getRandomPartyBSignerName(): string {
    return this.PARTY_B_SIGNERS[
      Math.floor(Math.random() * this.PARTY_B_SIGNERS.length)
    ];
  }
}
