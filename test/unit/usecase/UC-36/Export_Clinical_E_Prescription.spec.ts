import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { PrescriptionsService } from '../../../../src/modules/prescriptions/prescriptions.service';

describe('UC-36 Export Clinical E-Prescription', () => {
  const createPrescriptionContext = ({
    appointment,
    ePrescription,
    aggregatedData,
    pdfBuffer = Buffer.from('pdf-content'),
  }: {
    appointment?: any;
    ePrescription?: any;
    aggregatedData?: any;
    pdfBuffer?: Buffer;
  }) => ({
    appointmentRepository: {
      findOne: jest.fn().mockResolvedValue(appointment),
    },
    ePrescriptionRepository: {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(ePrescription),
      }),
    },
    dataSource: {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(aggregatedData),
      }),
    },
    pdfGeneratorService: {
      generateEPrescriptionPdf: jest.fn().mockResolvedValue(pdfBuffer),
    },
    getPatientEPrescription: jest.fn(),
  } as any);

  const appointmentId = '123e4567-e89b-12d3-a456-426614174000';

  it('UT-36-01: Export e-prescription PDF successfully.', async () => {
    const ePrescriptionData = { _id: 'ep-1', detail_e_prescriptions: [] };
    const aggregatedData = { appointment_id: appointmentId, clinic_name: 'Clinic' };
    const pdfBuffer = Buffer.from('pdf-content');
    const serviceContext = createPrescriptionContext({
      aggregatedData,
      pdfBuffer,
    });
    serviceContext.getPatientEPrescription.mockResolvedValue(ePrescriptionData);

    const result = await PrescriptionsService.prototype.generateEPrescriptionPdf.call(
      serviceContext,
      'patient-1',
      appointmentId,
    );

    expect(result).toBe(pdfBuffer);
    expect(serviceContext.getPatientEPrescription).toHaveBeenCalledWith(
      'patient-1',
      appointmentId,
    );
    expect(
      serviceContext.pdfGeneratorService.generateEPrescriptionPdf,
    ).toHaveBeenCalledWith({
      ePrescription: ePrescriptionData,
      aggregatedData,
    });
  });

  it('UT-36-02: Export PDF successfully with correct download headers.', async () => {
    const pdfBuffer = Buffer.from('pdf-content');
    const controllerContext = {
      prescriptionsService: {
        generateEPrescriptionPdf: jest.fn().mockResolvedValue(pdfBuffer),
      },
    } as any;
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    await AppointmentsController.prototype.exportEPrescriptionPdf.call(
      controllerContext,
      appointmentId,
      { user: { _id: 'patient-1' } },
      res,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="prescription-${appointmentId}.pdf"`,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Length',
      pdfBuffer.length.toString(),
    );
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });

  it('UT-36-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.exportEPrescriptionPdf,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-36-04: Reject authenticated non-patient role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.exportEPrescriptionPdf,
    );

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-36-05: Reject invalid ownership or non-completed appointment.', async () => {
    const serviceContext = createPrescriptionContext({
      appointment: null,
    });

    await expect(
      PrescriptionsService.prototype.getPatientEPrescription.call(
        serviceContext,
        'patient-1',
        appointmentId,
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found or access denied'));
  });

  it('UT-36-06: Reject missing e-prescription record.', async () => {
    const serviceContext = createPrescriptionContext({
      appointment: { _id: appointmentId },
      ePrescription: null,
    });

    await expect(
      PrescriptionsService.prototype.getPatientEPrescription.call(
        serviceContext,
        'patient-1',
        appointmentId,
      ),
    ).rejects.toThrow(new NotFoundException('E-Prescription not found'));
  });

  it('UT-36-07: Reject missing metadata for PDF generation.', async () => {
    const serviceContext = createPrescriptionContext({
      aggregatedData: null,
    });
    serviceContext.getPatientEPrescription.mockResolvedValue({ _id: 'ep-1' });

    await expect(
      PrescriptionsService.prototype.generateEPrescriptionPdf.call(
        serviceContext,
        'patient-1',
        appointmentId,
      ),
    ).rejects.toThrow(
      new NotFoundException('Unable to retrieve appointment metadata for PDF generation'),
    );
  });

  it('UT-36-08: Reject invalid appointment UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('invalid_format_appointment_id', {} as any),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });
});
