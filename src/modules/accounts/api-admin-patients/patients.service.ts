import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { PatientAppointmentStatisticsDto } from './dto/patient-appointment-statistics.dto';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { BanType } from '../enums/ban-type.enum';
import { BanHistory } from '../entities/ban-history.entity';
import { PatientResponseDto } from './dto/patient-response.dto';
import { MailerService } from '../../mailer/mailer.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(BanHistory)
    private readonly banHistoryRepository: Repository<BanHistory>,
    private readonly mailerService: MailerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getAppointmentStatistics(
    patientId: string,
  ): Promise<PatientAppointmentStatisticsDto> {
    const patient = await this.accountRepository.findOne({
      where: { _id: patientId, role: AccountRole.PATIENT },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found.`);
    }

    const stats = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.clinic', 'clinicAccount')
      .leftJoin(
        'clinicAccount.clinicManagerInformation',
        'clinicManagerInformation',
      )
      .leftJoin('clinicAccount.parent', 'clinicAdminAccount')
      .leftJoin(
        'clinicAdminAccount.clinicAdminInformation',
        'clinicAdminInformation',
      )
      .select([
        'appointment.clinicId AS "clinicId"',
        'clinicManagerInformation.clinicBranchName AS "branchName"',
        'clinicAdminInformation.clinicName AS "clinicAdminName"',
        'COUNT(appointment._id)::int AS "appointmentCount"',
        'MAX(appointment.createdAt) AS "latestAppointmentDate"',
      ])
      .where('appointment.patientId = :patientId', { patientId })
      .groupBy(
        'appointment.clinicId, clinicManagerInformation.clinicBranchName, clinicAdminInformation.clinicName',
      )
      .getRawMany();

    const details = stats.map((stat) => ({
      clinicId: stat.clinicId,
      branchName: stat.branchName || 'Unknown Branch',
      clinicAdminName: stat.clinicAdminName || 'Unknown Brand',
      appointmentCount: Number(stat.appointmentCount),
      latestAppointmentDate: stat.latestAppointmentDate,
    }));

    return {
      totalClinics: details.length,
      details,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: PatientResponseDto[]; total: number }> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.generalAccount', 'generalAccount')
      .leftJoinAndSelect('account.address', 'address')
      .leftJoinAndSelect('address.googleIframe', 'googleIframe')
      .where('account.role = :role', { role: AccountRole.PATIENT });

    if (search) {
      query.andWhere(
        '(account.username ILIKE :search OR account.email ILIKE :search OR account.phone ILIKE :search OR generalAccount.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [accounts, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = accounts.map((account) => new PatientResponseDto(account));

    return { data, total };
  }

  async findOne(id: string): Promise<PatientResponseDto> {
    const account = await this.accountRepository.findOne({
      where: { _id: id, role: AccountRole.PATIENT },
      relations: ['generalAccount', 'address', 'address.googleIframe'],
    });

    if (!account) {
      throw new NotFoundException(`Patient with ID ${id} not found.`);
    }

    return new PatientResponseDto(account);
  }

  async banPatient(
    id: string,
    banDescription?: string,
  ): Promise<PatientResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await this.accountRepository.findOne({
        where: { _id: id, role: AccountRole.PATIENT },
      });

      if (!account) {
        throw new NotFoundException(`Patient with ID ${id} not found.`);
      }

      account.banCounts += 1;
      account.banDescription = banDescription;

      const patientName =
        account.generalAccount?.fullName || account.username || 'Patient';

      if (account.banCounts >= 3) {
        account.status = AccountStatus.BAN;
      }

      await queryRunner.manager.save(Account, account);

      const banHistory = this.banHistoryRepository.create({
        accountId: account._id,
        banCounts: account.banCounts,
        type: account.banCounts >= 3 ? BanType.BANNED : BanType.WARNING,
        banDescription: banDescription,
      });
      await queryRunner.manager.save(BanHistory, banHistory);

      await queryRunner.commitTransaction();

      if (account.banCounts >= 3) {
        await this.mailerService.sendAccountBannedEmail(
          account.email,
          patientName,
          banDescription || 'Multiple violations of terms of service.',
        );
      } else {
        await this.mailerService.sendAccountWarningEmail(
          account.email,
          patientName,
          banDescription || 'Violation of terms of service.',
          account.banCounts,
        );
      }

      return new PatientResponseDto(account);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async unbanPatient(id: string): Promise<PatientResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await this.accountRepository.findOne({
        where: { _id: id, role: AccountRole.PATIENT },
      });

      if (!account) {
        throw new NotFoundException(`Patient with ID ${id} not found.`);
      }

      if (account.status === AccountStatus.BAN) {
        account.status = AccountStatus.ACTIVE;
        account.banCounts = 0;
        account.banDescription = null;

        await queryRunner.manager.save(Account, account);

        const banHistory = this.banHistoryRepository.create({
          accountId: account._id,
          banCounts: 0,
          type: BanType.UNBANNED,
        });
        await queryRunner.manager.save(BanHistory, banHistory);

        await queryRunner.commitTransaction();

        const patientName =
          account.generalAccount?.fullName || account.username || 'Patient';
        await this.mailerService.sendAccountUnbannedEmail(
          account.email,
          patientName,
        );
      } else {
        await queryRunner.rollbackTransaction();
      }

      return new PatientResponseDto(account);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getBanHistory(patientId: string): Promise<BanHistory[]> {
    const patient = await this.accountRepository.findOne({
      where: { _id: patientId, role: AccountRole.PATIENT },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found.`);
    }

    return this.banHistoryRepository.find({
      where: { accountId: patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
