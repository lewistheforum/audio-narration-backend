import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-23 View Appointment Details', () => {
  const createChainBuilder = (overrides: Record<string, jest.Mock> = {}) => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    ...overrides,
  });

  const createAppointmentRaw = (overrides: Record<string, unknown> = {}) => ({
    appointment_id: 'appointment-1',
    appointment_date: '2026-03-15',
    appointment_hour: '2026-03-15T08:00:00.000Z',
    extra_hour: null,
    clinic_shift_hour_id: 'shift-1',
    status: AppointmentStatus.CONFIRMED,
    total: 0,
    patient_note: null,
    reject_reason: null,
    diagnosis: null,
    created_at: '2026-03-15T00:00:00.000Z',
    updated_at: '2026-03-15T00:00:00.000Z',
    clinic_id: 'clinic-1',
    clinic_name: 'Clinic',
    clinic_address: 'Address',
    clinic_phone: '0123',
    clinic_profile_picture: null,
    doctor_id: 'doctor-1',
    doctor_name: 'Doctor',
    doctor_profile_picture: null,
    start_hour: '08:00:00',
    end_hour: '09:00:00',
    clinic_room: 'Room 1',
    ...overrides,
  });

  const createServiceContext = (options?: {
    appointmentRaw?: any;
    packages?: any[];
    serviceAppointments?: any[];
    doctorDetails?: any;
    ePrescriptions?: any[];
  }) => {
    const appointmentRaw = options?.appointmentRaw;
    const packages = options?.packages ?? [];
    const serviceAppointments = options?.serviceAppointments ?? [];
    const doctorDetails = options?.doctorDetails ?? null;
    const ePrescriptions = options?.ePrescriptions ?? [];

    const builders = [
      createChainBuilder({ getRawOne: jest.fn().mockResolvedValue(appointmentRaw) }),
      createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(packages) }),
      createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(serviceAppointments) }),
    ];

    if (appointmentRaw?.doctor_id) {
      builders.push(
        createChainBuilder({ getRawOne: jest.fn().mockResolvedValue(doctorDetails) }),
      );
    }

    builders.push(
      createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(ePrescriptions) }),
    );

    return {
      dataSource: {
        createQueryBuilder: jest.fn(() => builders.shift()),
      },
      normalizeMoney: AppointmentsService.prototype['normalizeMoney'],
      calculateServiceFinalPrice:
        AppointmentsService.prototype['calculateServiceFinalPrice'],
      calculatePackageAmountFromServices:
        AppointmentsService.prototype['calculatePackageAmountFromServices'],
      calculateAppointmentTotalFromPackages:
        AppointmentsService.prototype['calculateAppointmentTotalFromPackages'],
    } as any;
  };

  it('UT-23-01: View standard appointment detail successfully.', async () => {
    const appointmentsService = {
      getMyAppointmentDetail: jest.fn().mockResolvedValue({ _id: 'appointment-1' }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );

    await controller.getMyAppointmentDetail(
      { user: { _id: 'patient-1' } },
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(appointmentsService.getMyAppointmentDetail).toHaveBeenCalledWith(
      'patient-1',
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('UT-23-02: View completed appointment detail with ERM and e-prescription summary.', async () => {
    const serviceContext = createServiceContext({
      appointmentRaw: createAppointmentRaw({ status: AppointmentStatus.COMPLETED }),
      packages: [
        {
          package_id: 'package-1',
          amount: '0',
          payment_type: 'cod',
          payment_status: 'paid',
          transaction_payment_status: null,
        },
      ],
      serviceAppointments: [
        {
          sa_id: 'sa-1',
          package_id: 'package-1',
          service_id: 'service-1',
          service_name: 'Consultation',
          price: '100000',
          discount: '0',
          erm_id: 'erm-1',
          erm_record_type: 'CONSULTATION',
          erm_status: 'COMPLETED',
          erm_service_code: 'ERM-001',
          erm_signed_at: '2026-03-15T02:00:00.000Z',
          erm_created_at: '2026-03-15T01:00:00.000Z',
          ec_id: 'consultation-1',
          ec_created_at: '2026-03-15T01:30:00.000Z',
          erd_id: null,
          el_id: null,
          ex_id: null,
          eu_id: null,
        },
      ],
      doctorDetails: { academic_degree: 'MD', position: 'Physician' },
      ePrescriptions: [
        {
          id: 'ep-1',
          reference_id: 'EP-001',
          doctor_note: 'Take after meal',
          created_at: '2026-03-15T03:00:00.000Z',
          updated_at: '2026-03-15T03:00:00.000Z',
          detail_id: 'detail-1',
          detail_quantity: 2,
          detail_note: 'Morning',
          medicine_id: 'med-1',
          medicine_name: 'Paracetamol',
        },
      ],
    });

    const result = await AppointmentsService.prototype.getMyAppointmentDetail.call(
      serviceContext,
      'patient-1',
      'appointment-1',
    );

    expect(result.status).toBe(AppointmentStatus.COMPLETED);
    expect(result.erms).toHaveLength(1);
    expect(result.e_prescription).toMatchObject({
      _id: 'ep-1',
      reference_id: 'EP-001',
    });
    expect(result.doctor).toMatchObject({ academicDegree: 'MD', position: 'Physician' });
  });

  it('UT-23-03: View cancelled appointment detail with reject_reason.', async () => {
    const serviceContext = createServiceContext({
      appointmentRaw: createAppointmentRaw({
        status: AppointmentStatus.CANCELLED,
        reject_reason: 'Doctor unavailable',
      }),
      doctorDetails: { academic_degree: null, position: null },
    });

    const result = await AppointmentsService.prototype.getMyAppointmentDetail.call(
      serviceContext,
      'patient-1',
      'appointment-1',
    );

    expect(result.reject_reason).toBe('Doctor unavailable');
  });

  it('UT-23-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.getMyAppointmentDetail,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-23-05: Reject authenticated non-patient role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.getMyAppointmentDetail,
    );

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-23-06: Reject invalid or unauthorized appointment id.', async () => {
    const serviceContext = createServiceContext({ appointmentRaw: null });

    await expect(
      AppointmentsService.prototype.getMyAppointmentDetail.call(
        serviceContext,
        'patient-1',
        'missing-appointment',
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-23-07: Return out-of-hours appointment detail successfully.', async () => {
    const serviceContext = createServiceContext({
      appointmentRaw: createAppointmentRaw({
        extra_hour: '2026-03-15T19:30:00.000Z',
        clinic_shift_hour_id: null,
        start_hour: null,
        end_hour: null,
      }),
      doctorDetails: { academic_degree: null, position: null },
    });

    const result = await AppointmentsService.prototype.getMyAppointmentDetail.call(
      serviceContext,
      'patient-1',
      'appointment-1',
    );

    expect(result).toMatchObject({
      extra_hour: '2026-03-15T19:30:00.000Z',
      clinic_shift_hour_id: null,
      start_hour: null,
      end_hour: null,
    });
  });

  it('UT-23-08: Return appointment detail with no assigned doctor.', async () => {
    const serviceContext = createServiceContext({
      appointmentRaw: createAppointmentRaw({ doctor_id: null, doctor_name: null }),
    });

    const result = await AppointmentsService.prototype.getMyAppointmentDetail.call(
      serviceContext,
      'patient-1',
      'appointment-1',
    );

    expect(result.doctor).toBeUndefined();
  });

  it('UT-23-09: Reject invalid appointment UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });
});
