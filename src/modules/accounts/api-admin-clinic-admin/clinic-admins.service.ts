import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { ClinicSubscription } from '../../subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../../subscriptions/entities/clinic-subscription-history.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { ClinicServiceConfig } from '../../service-configs/entities/clinic-service-config.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { BanType } from '../enums/ban-type.enum';
import { BanHistory } from '../entities/ban-history.entity';
import { MailerService } from '../../mailer/mailer.service';
import {
  ClinicAdminResponseDto,
  ClinicAdminDetailResponseDto,
} from './dto/clinic-admin-response.dto';
import {
  ClinicAdminSubscriptionHistoryItemDto,
  TransactionHistoryItemDto,
} from './dto/clinic-admin-subscription-history.dto';
import { ClinicAdminClinicServiceDto } from './dto/clinic-admin-clinic-service.dto';
import { ClinicAdminFeedbackResponseDto } from './dto/clinic-admin-feedback-response.dto';
import { ClinicAdminFeedbackDetailResponseDto } from './dto/clinic-admin-feedback-detail.dto';
import { ClinicAdminFeedbackListDto } from './dto/clinic-admin-feedback-list.dto';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { Feedback } from '../../reports/entities/feedback.entity';
import { FeedbackType } from '../../reports/enums/feedback-type.enum';
import { DoctorInformation } from '../entities/doctor_information.entity';

/**
 * ClinicAdminsService
 *
 * Business logic for managing clinic admin accounts from the system admin perspective.
 * Provides listing, detail view with statistics, subscription/transaction history,
 * and examination service queries.
 */
@Injectable()
export class ClinicAdminsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(ClinicSubscriptionHistory)
    private readonly clinicSubscriptionHistoryRepository: Repository<ClinicSubscriptionHistory>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(ClinicServiceConfig)
    private readonly clinicServiceConfigRepository: Repository<ClinicServiceConfig>,
    @InjectRepository(BanHistory)
    private readonly banHistoryRepository: Repository<BanHistory>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
    private readonly mailerService: MailerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Find all clinic admin accounts with pagination and search
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: ClinicAdminResponseDto[]; total: number }> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect(
        'account.clinicAdminInformation',
        'clinicAdminInformation',
      )
      .where('account.role = :role', { role: AccountRole.CLINIC_ADMIN });

    if (search) {
      query.andWhere(
        '(account.username ILIKE :search OR account.email ILIKE :search OR account.phone ILIKE :search OR clinicAdminInformation.clinicName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('account.createdAt', 'DESC');

    const [accounts, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = accounts.map((account) => new ClinicAdminResponseDto(account));

    return { data, total };
  }

  /**
   * Find clinic admin detail by ID with linked account statistics
   * and current subscription information
   */
  async findOne(id: string): Promise<ClinicAdminDetailResponseDto> {
    const account = await this.accountRepository.findOne({
      where: { _id: id, role: AccountRole.CLINIC_ADMIN },
      relations: ['clinicAdminInformation', 'address', 'address.googleIframe'],
    });

    if (!account) {
      throw new NotFoundException(`Clinic admin with ID ${id} not found.`);
    }

    // Count CLINIC_MANAGER (direct children of clinic admin)
    const managerChildren = await this.accountRepository.find({
      where: { parentId: id, role: AccountRole.CLINIC_MANAGER },
      select: ['_id'],
    });

    const clinicManagerCount = managerChildren.length;
    let doctorCount = 0;
    let staffCount = 0;

    // Count DOCTOR and STAFF (children of clinic managers = grandchildren of clinic admin)
    if (managerChildren.length > 0) {
      const managerIds = managerChildren.map((m) => m._id);

      const grandchildCounts = await this.accountRepository
        .createQueryBuilder('grandchild')
        .select('grandchild.role', 'role')
        .addSelect('COUNT(grandchild._id)', 'count')
        .where('grandchild.parentId = ANY(:managerIds)', { managerIds })
        .andWhere('grandchild.role = ANY(:roles)', {
          roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
        })
        .groupBy('grandchild.role')
        .getRawMany();

      for (const row of grandchildCounts) {
        if (row.role === AccountRole.DOCTOR) {
          doctorCount = parseInt(row.count, 10);
        } else if (row.role === AccountRole.CLINIC_STAFF) {
          staffCount = parseInt(row.count, 10);
        }
      }
    }

    // Get current subscription
    const subscription = await this.clinicSubscriptionRepository.findOne({
      where: { clinicId: id },
      relations: ['service'],
    });

    // Build response
    const dto = new ClinicAdminDetailResponseDto(account);
    dto.description = account.clinicAdminInformation?.description;
    dto.specializedIn = account.clinicAdminInformation?.specializedIn;
    dto.pros = account.clinicAdminInformation?.pros;
    dto.paraclinical = account.clinicAdminInformation?.paraclinical;
    dto.dob = account.clinicAdminInformation?.dob;
    dto.bankName = account.clinicAdminInformation?.bankName;
    dto.sepayVa = account.clinicAdminInformation?.sepayVa;

    dto.clinicManagerCount = clinicManagerCount;
    dto.doctorCount = doctorCount;
    dto.staffCount = staffCount;

    if (subscription) {
      dto.subscriptionServiceName = subscription.service?.serviceName;
      dto.subscriptionDate = subscription.subscriptionDate;
      dto.expirationDate = subscription.expirationDate;
      dto.subscriptionStatus = subscription.subscriptionStatus;
    }

    if (account.address) {
      dto.address = {
        _id: account.address._id,
        address: account.address.address,
        ward: account.address.ward,
        district: account.address.district,
        province: account.address.province,
        wardName: account.address.wardName,
        districtName: account.address.districtName,
        provinceName: account.address.provinceName,
      };

      if (account.address.googleIframe) {
        dto.address.googleIframe = {
          _id: account.address.googleIframe._id,
          location: account.address.googleIframe.location,
          googleMapIframe: account.address.googleIframe.googleMapIframe,
        };
      }
    }

    return dto;
  }

  /**
   * Get subscription registration history for a clinic admin
   */
  async getSubscriptionHistory(
    clinicAdminId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: ClinicAdminSubscriptionHistoryItemDto[]; total: number }> {
    const account = await this.accountRepository.findOne({
      where: { _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN },
    });

    if (!account) {
      throw new NotFoundException(
        `Clinic admin with ID ${clinicAdminId} not found.`,
      );
    }

    const [histories, total] = await this.clinicSubscriptionHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.service', 'service')
      .where('history.clinicId = :clinicId', { clinicId: clinicAdminId })
      .orderBy('history.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data: ClinicAdminSubscriptionHistoryItemDto[] = histories.map(
      (h) => ({
        id: h._id,
        serviceName: h.service?.serviceName || 'Unknown',
        serviceCode: h.service?.code,
        subscriptionDate: h.subscriptionDate,
        expirationDate: h.expirationDate,
        subscriptionStatus: h.subscriptionStatus,
        createdAt: h.createdAt,
      }),
    );

    return { data, total };
  }

  /**
   * Get transaction history for a clinic admin
   */
  async getTransactionHistory(
    clinicAdminId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: TransactionHistoryItemDto[]; total: number }> {
    const account = await this.accountRepository.findOne({
      where: { _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN },
    });

    if (!account) {
      throw new NotFoundException(
        `Clinic admin with ID ${clinicAdminId} not found.`,
      );
    }

    const [transactions, total] = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.transactionType', 'transactionType')
      .where('transaction.clinicId = :clinicId', { clinicId: clinicAdminId })
      .orderBy('transaction.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data: TransactionHistoryItemDto[] = transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      transactionDate: t.transactionDate,
      gateway: t.gateway,
      content: t.content,
      description: t.description,
      code: t.code,
      transactionTypeName: t.transactionType?.name,
      createdAt: t.createdAt,
    }));

    return { data, total };
  }

  /**
   * Get clinic services available for this clinic admin's clinics
   *
   * Finds all CLINIC_MANAGER children of this clinic admin,
   * then queries ClinicServiceConfig for those managers
   */
  async getClinicServices(
    clinicAdminId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: ClinicAdminClinicServiceDto[]; total: number }> {
    const account = await this.accountRepository.findOne({
      where: { _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN },
    });

    if (!account) {
      throw new NotFoundException(
        `Clinic admin with ID ${clinicAdminId} not found.`,
      );
    }

    // Find all CLINIC_MANAGER children of this clinic admin
    const managerChildren = await this.accountRepository.find({
      where: { parentId: clinicAdminId, role: AccountRole.CLINIC_MANAGER },
      select: ['_id'],
      relations: ['clinicManagerInformation'],
    });

    if (managerChildren.length === 0) {
      return { data: [], total: 0 };
    }

    const managerIds = managerChildren.map((m) => m._id);
    const managerNameMap: Record<string, string> = {};
    for (const m of managerChildren) {
      managerNameMap[m._id] =
        m.clinicManagerInformation?.clinicBranchName || 'Unknown Branch';
    }

    const query = this.clinicServiceConfigRepository
      .createQueryBuilder('config')
      .leftJoinAndSelect('config.service', 'service')
      .leftJoin('service.category', 'category')
      .addSelect(['category._id', 'category.categoryName', 'category.type'])
      .where('config.clinicId = ANY(:managerIds)', { managerIds });

    if (search) {
      query.andWhere(
        '(service.serviceName ILIKE :search OR service.serviceCode ILIKE :search OR category.categoryName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('service.serviceName', 'ASC');

    const [configs, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data: ClinicAdminClinicServiceDto[] = configs.map((c) => ({
      id: c._id,
      serviceName: c.service?.serviceName || 'Unknown',
      serviceCode: c.service?.serviceCode || '',
      description: c.service?.description,
      categoryName: c.service?.category?.categoryName || '',
      price: c.price,
      discount: c.discount,
      durationMin: c.durationMin,
      noteForPatient: c.noteForPatient,
      isActive: c.isActive,
      branchName: managerNameMap[c.clinicId] || 'Unknown Branch',
      clinicManagerId: c.clinicId,
    }));

    return { data, total };
  }

  /**
   * Ban a clinic admin
   *
   * Increments ban counts. If hits 3 strikes, bans the admin and ALL linked accounts.
   * Sends appropriate email (Warning or Banned).
   */
  async banClinicAdmin(
    id: string,
    banDescription?: string,
  ): Promise<ClinicAdminResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await queryRunner.manager.findOne(Account, {
        where: { _id: id, role: AccountRole.CLINIC_ADMIN },
        relations: ['clinicAdminInformation'],
      });

      if (!account) {
        throw new NotFoundException(`Clinic admin with ID ${id} not found.`);
      }

      account.banCounts += 1;
      account.banDescription = banDescription;

      const clinicName =
        account.clinicAdminInformation?.clinicName ||
        account.username ||
        'Clinic';

      if (account.banCounts >= 3) {
        account.status = AccountStatus.BAN;

        const managers = await queryRunner.manager.find(Account, {
          where: { parentId: id, role: AccountRole.CLINIC_MANAGER },
          select: ['_id'],
        });
        const managerIds = managers.map((m) => m._id);

        let grandChildrenIds: string[] = [];
        if (managerIds.length > 0) {
          const grandChildren = await queryRunner.manager
            .createQueryBuilder()
            .select('account._id', '_id')
            .from(Account, 'account')
            .where('account.parentId = ANY(:managerIds)', { managerIds })
            .andWhere('account.role = ANY(:roles)', {
              roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
            })
            .getRawMany();
          grandChildrenIds = grandChildren.map((gc: { _id: string }) => gc._id);
        }

        const allAccountsToBan = [...managerIds, ...grandChildrenIds];
        if (allAccountsToBan.length > 0) {
          await queryRunner.manager
            .createQueryBuilder()
            .update(Account)
            .set({ status: AccountStatus.BAN })
            .where('_id = ANY(:ids)', { ids: allAccountsToBan })
            .execute();
        }

        await queryRunner.manager.save(Account, account);
        await queryRunner.commitTransaction();

        await this.mailerService.sendClinicAdminBannedEmail(
          account.email,
          clinicName,
          banDescription || 'Multiple violations of terms of service.',
        );
      } else {
        await queryRunner.manager.save(Account, account);
        await queryRunner.commitTransaction();

        await this.mailerService.sendClinicAdminWarningEmail(
          account.email,
          clinicName,
          banDescription || 'Violation of terms of service.',
          account.banCounts,
        );
      }

      const banHistory = this.banHistoryRepository.create({
        accountId: account._id,
        banCounts: account.banCounts,
        type: account.banCounts >= 3 ? BanType.BANNED : BanType.WARNING,
        banDescription: banDescription,
      });
      await this.banHistoryRepository.save(banHistory);

      return new ClinicAdminResponseDto(account);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Unban a clinic admin
   *
   * Resets status to ACTIVE and ban counts to 0.
   * Restores ALL linked accounts to ACTIVE.
   * Sends unbanned email.
   */
  async unbanClinicAdmin(id: string): Promise<ClinicAdminResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await queryRunner.manager.findOne(Account, {
        where: { _id: id, role: AccountRole.CLINIC_ADMIN },
        relations: ['clinicAdminInformation'],
      });

      if (!account) {
        throw new NotFoundException(`Clinic admin with ID ${id} not found.`);
      }

      if (account.status === AccountStatus.BAN) {
        account.status = AccountStatus.ACTIVE;
        account.banCounts = 0;
        account.banDescription = null;

        const managers = await queryRunner.manager.find(Account, {
          where: { parentId: id, role: AccountRole.CLINIC_MANAGER },
          select: ['_id'],
        });
        const managerIds = managers.map((m) => m._id);

        let grandChildrenIds: string[] = [];
        if (managerIds.length > 0) {
          const grandChildren = await queryRunner.manager
            .createQueryBuilder()
            .select('account._id', '_id')
            .from(Account, 'account')
            .where('account.parentId = ANY(:managerIds)', { managerIds })
            .andWhere('account.role = ANY(:roles)', {
              roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
            })
            .getRawMany();
          grandChildrenIds = grandChildren.map((gc: { _id: string }) => gc._id);
        }

        const allAccountsToUnban = [...managerIds, ...grandChildrenIds];
        if (allAccountsToUnban.length > 0) {
          await queryRunner.manager
            .createQueryBuilder()
            .update(Account)
            .set({ status: AccountStatus.ACTIVE })
            .where('_id = ANY(:ids)', { ids: allAccountsToUnban })
            .execute();
        }

        await queryRunner.manager.save(Account, account);
        await queryRunner.commitTransaction();

        const clinicName =
          account.clinicAdminInformation?.clinicName ||
          account.username ||
          'Clinic';
        await this.mailerService.sendClinicAdminUnbannedEmail(
          account.email,
          clinicName,
        );
      } else {
        await queryRunner.rollbackTransaction();
      }

      const banHistory = this.banHistoryRepository.create({
        accountId: account._id,
        banCounts: 0,
        type: BanType.UNBANNED,
      });
      await this.banHistoryRepository.save(banHistory);

      return new ClinicAdminResponseDto(account);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get list of feedbacks for clinics managed by this admin
   */
  async getFeedbacks(
    clinicAdminId: string,
  ): Promise<{ data: ClinicAdminFeedbackListDto; total: number }> {
    const admin = await this.accountRepository.findOne({
      where: { _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN },
    });

    if (!admin) {
      throw new NotFoundException(
        `Clinic admin with ID ${clinicAdminId} not found.`,
      );
    }

    // 1. Get all clinic managers (branches) under this clinic admin
    const managers = await this.accountRepository.find({
      where: { parentId: clinicAdminId, role: AccountRole.CLINIC_MANAGER },
      select: ['_id'],
    });
    const managerIds = managers.map((m) => m._id);

    if (managerIds.length === 0) {
      return { data: { clinics: [], doctors: [] }, total: 0 };
    }

    // 2. Query Feedbacks
    const rawQuery = this.feedbackRepository
      .createQueryBuilder('feedback')
      .leftJoin('feedback.clinic', 'clinic')
      .leftJoin('clinic.clinicManagerInformation', 'clinicInfo')
      .leftJoin('feedback.doctor', 'doctor')
      .leftJoin('doctor.generalAccount', 'doctorGeneral')
      .leftJoin(
        DoctorInformation,
        'doctorInfo',
        'doctorInfo.accountId = doctor._id',
      )
      .leftJoin(
        Appointment,
        'appointment',
        'appointment._id = feedback.appointmentId',
      )
      .leftJoin('appointment.patient', 'patient')
      .leftJoin('patient.generalAccount', 'patientGeneral')
      .where('feedback.clinicId = ANY(:managerIds)', { managerIds });

    const rawData = await rawQuery
      .select([
        'feedback._id AS id',
        'feedback.rating AS rating',
        'feedback.description AS description',
        'feedback.clinicId AS "clinicId"',
        'feedback.type AS type',
        'feedback.createdAt AS "createdAt"',
        'clinic.username AS "clinicUsername"',
        'clinicInfo.clinicBranchName AS "clinicName"',
        'doctor.username AS "doctorUsername"',
        'doctorGeneral.fullName AS "doctorFullName"',
        'doctorInfo.fullName AS "doctorName"',
        'patientGeneral.fullName AS "patientName"',
        'patientGeneral.profilePicture AS "patientAvatar"',
      ])
      .orderBy('feedback.createdAt', 'DESC')
      .getRawMany();

    const totalCount = await rawQuery.getCount();

    const clinics: ClinicAdminFeedbackResponseDto[] = [];
    const doctors: ClinicAdminFeedbackResponseDto[] = [];

    rawData.forEach((row) => {
      const dto = new ClinicAdminFeedbackResponseDto({
        _id: row.id,
        rating: row.rating,
        description: row.description,
        clinicId: row.clinicId,
        type: row.type,
        createdAt: row.createdAt,
      } as any);

      dto.clinicName = row.clinicName || row.clinicUsername;
      dto.doctorName = row.doctorName;
      dto.patientName = row.patientName || 'Unknown';
      dto.patientAvatar = row.patientAvatar;

      if (row.type === FeedbackType.CLINIC) {
        clinics.push(dto);
      } else if (row.type === FeedbackType.DOCTOR) {
        doctors.push(dto);
      }
    });

    return { data: { clinics, doctors }, total: totalCount };
  }

  /**
   * Get feedback detail
   */
  async getFeedbackDetail(
    clinicManagerId: string,
    feedbackId: string,
  ): Promise<ClinicAdminFeedbackDetailResponseDto> {
    const feedback = await this.feedbackRepository.findOne({
      where: {
        _id: feedbackId,
        clinicId: clinicManagerId,
      },
      relations: [
        'clinic',
        'clinic.clinicManagerInformation',
        'doctor',
        'doctor.generalAccount',
        'doctor.doctorInformation',
      ],
    });

    if (!feedback) {
      throw new NotFoundException(`Feedback not found.`);
    }

    const appointment = await this.appointmentRepository.findOne({
      where: { _id: feedback.appointmentId },
      relations: ['patient', 'patient.generalAccount'],
    });

    return new ClinicAdminFeedbackDetailResponseDto(
      feedback,
      appointment,
      feedback.clinic,
      feedback.doctor,
    );
  }

  /**
   * Get ban history for a clinic admin
   */
  async getBanHistory(id: string): Promise<BanHistory[]> {
    const account = await this.accountRepository.findOne({
      where: { _id: id, role: AccountRole.CLINIC_ADMIN },
    });

    if (!account) {
      throw new NotFoundException(`Clinic admin with ID ${id} not found.`);
    }

    return this.banHistoryRepository.find({
      where: { accountId: id },
      order: { createdAt: 'DESC' },
    });
  }
}







