import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';

describe('UC-41 View Doctor Details', () => {
  const createDoctorQueryBuilder = (doctor: any) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(doctor),
  });

  const createDoctor = (overrides: Record<string, any> = {}) => ({
    _id: 'doctor-1',
    username: 'doctor.one',
    email: 'doctor.one@example.com',
    phone: '0123456789',
    role: AccountRole.DOCTOR,
    status: AccountStatus.ACTIVE,
    parentId: 'clinic-1',
    createdAt: new Date('2099-01-10T12:30:00.000Z'),
    parent: {
      clinicManagerInformation: {
        _id: 'clinic-info-1',
        clinicBranchName: 'Clinic A',
      },
      phone: '0987654321',
    },
    employeeSchedules: [],
    ...overrides,
  });

  const doctorInfo = {
    _id: 'doctor-info-1',
    fullName: 'Dr. John Smith',
    academicDegree: 'MD',
    position: 'Cardiologist',
    experience: '10 years',
    profilePicture: 'https://example.com/doctor.jpg',
    deletedAt: null,
  };

  it('UT-41-01: View doctor profile successfully.', async () => {
    const serviceContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(createDoctorQueryBuilder(createDoctor())),
      },
      doctorInfoRepository: {
        findPublicByDoctorAccountId: jest.fn().mockResolvedValue(doctorInfo),
      },
      dataSource: {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ avg_rating: '4.50' }])
          .mockResolvedValueOnce([
            {
              _id: 'feedback-1',
              rating: 5,
              description: 'Great doctor',
              description_label: null,
              feedback_images: null,
              feedback_images_label: null,
              created_at: new Date('2099-01-10T12:30:00.000Z'),
              patient_name: 'Patient A',
              patient_profile_picture: null,
            },
          ]),
      },
    } as any;

    const result = await AccountsService.prototype.getPublicDoctorById.call(
      serviceContext,
      'doctor-1',
    );

    expect(result.id).toBe('doctor-1');
    expect(result.clinic?.clinicName).toBe('Clinic A');
    expect(result.averageRating).toBe(4.5);
    expect(result.feedbacks).toHaveLength(1);
  });

  it('UT-41-02: View doctor detail schedule successfully.', async () => {
    const schedules = [{ dayOfWeek: 'MONDAY', startTime: '07:00:00', endTime: '11:00:00' }];
    const serviceContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(createDoctorQueryBuilder(createDoctor({ employeeSchedules: [{}] }))),
      },
      processWorkingSchedules: jest.fn().mockReturnValue(schedules),
    } as any;

    const result = await AccountsService.prototype.getPublicDoctorDetailScheduleById.call(
      serviceContext,
      'doctor-1',
    );

    expect(result).toEqual(schedules);
  });

  it('UT-41-03: View doctor details successfully while authenticated token is ignored by public endpoint.', () => {
    const profileGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AccountsController.prototype.getDoctorById,
    );
    const scheduleGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AccountsController.prototype.getDoctorDetailScheduleById,
    );

    expect(profileGuards).toBeUndefined();
    expect(scheduleGuards).toBeUndefined();
  });

  it('UT-41-04: Reject invalid doctor UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-41-05: Reject missing doctor or missing doctor information.', async () => {
    const missingDoctorContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(createDoctorQueryBuilder(null)),
      },
    } as any;
    const missingInfoContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(createDoctorQueryBuilder(createDoctor())),
      },
      doctorInfoRepository: {
        findPublicByDoctorAccountId: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(
      AccountsService.prototype.getPublicDoctorById.call(missingDoctorContext, 'doctor-missing'),
    ).rejects.toThrow(new NotFoundException('Doctor not found'));
    await expect(
      AccountsService.prototype.getPublicDoctorById.call(missingInfoContext, 'doctor-1'),
    ).rejects.toThrow(new NotFoundException('Doctor information not found'));
  });

  it('UT-41-06: Return doctor profile with no clinic info.', async () => {
    const serviceContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(
          createDoctorQueryBuilder(
            createDoctor({ parent: { clinicManagerInformation: null, phone: '0987654321' } }),
          ),
        ),
      },
      doctorInfoRepository: {
        findPublicByDoctorAccountId: jest.fn().mockResolvedValue(doctorInfo),
      },
      dataSource: {
        query: jest.fn().mockResolvedValueOnce([{ avg_rating: '4.00' }]).mockResolvedValueOnce([]),
      },
    } as any;

    const result = await AccountsService.prototype.getPublicDoctorById.call(
      serviceContext,
      'doctor-1',
    );

    expect(result.clinic).toBeUndefined();
  });

  it('UT-41-07: Return doctor profile with no feedback rows and zero rating fallback.', async () => {
    const serviceContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(createDoctorQueryBuilder(createDoctor())),
      },
      doctorInfoRepository: {
        findPublicByDoctorAccountId: jest.fn().mockResolvedValue(doctorInfo),
      },
      dataSource: {
        query: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    const result = await AccountsService.prototype.getPublicDoctorById.call(
      serviceContext,
      'doctor-1',
    );

    expect(result.averageRating).toBe(0);
    expect(result.feedbacks).toEqual([]);
  });

  it('UT-41-08: Return empty schedule list when doctor has no schedules.', async () => {
    const serviceContext = {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(createDoctorQueryBuilder(createDoctor({ employeeSchedules: [] }))),
      },
      processWorkingSchedules: jest.fn().mockReturnValue([]),
    } as any;

    const result = await AccountsService.prototype.getPublicDoctorDetailScheduleById.call(
      serviceContext,
      'doctor-1',
    );

    expect(result).toEqual([]);
  });
});
