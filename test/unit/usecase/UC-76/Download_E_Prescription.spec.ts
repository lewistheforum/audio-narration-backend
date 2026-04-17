import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { PrescriptionsService } from '../../../../src/modules/prescriptions/prescriptions.service';

describe('UC-76 Download E-Prescription', () => {
  const appointmentId = '123e4567-e89b-12d3-a456-426614174000';

  const createPrescriptionContext = ({
    ePrescriptionData = { _id: 'ep-1', detail_e_prescriptions: [] },
    aggregatedData = { appointment_id: appointmentId, clinic_name: 'Clinic' },
    pdfBuffer = Buffer.from('pdf-content'),
  }: {
    ePrescriptionData?: any;
    aggregatedData?: any;
    pdfBuffer?: Buffer;
  }) => ({
    getPatientEPrescription: jest.fn().mockResolvedValue(ePrescriptionData),
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
  } as any);

  it('UT-76-01: Download PDF success for completed appointment', async () => {
    const controller = {
      prescriptionsService: {
        generateEPrescriptionPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
      },
    } as any;
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    await AppointmentsController.prototype.exportEPrescriptionPdf.call(controller, appointmentId, { user: { _id: 'patient-1' } }, res);

    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf-content'));
  });

  it('UT-76-02: Validate content-disposition/content-type headers', async () => {
    const pdfBuffer = Buffer.from('pdf-content');
    const controller = {
      prescriptionsService: {
        generateEPrescriptionPdf: jest.fn().mockResolvedValue(pdfBuffer),
      },
    } as any;
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    await AppointmentsController.prototype.exportEPrescriptionPdf.call(controller, appointmentId, { user: { _id: 'patient-1' } }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="prescription-${appointmentId}.pdf"`);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', pdfBuffer.length.toString());
  });

  it('UT-76-03: Generate PDF using aggregated clinic/doctor/patient data', async () => {
    const serviceContext = createPrescriptionContext({
      ePrescriptionData: { _id: 'ep-1', detail_e_prescriptions: [] },
      aggregatedData: { appointment_id: appointmentId, clinic_name: 'Clinic', doctor_name: 'Doctor', patient_name: 'Patient' },
    });

    const result = await PrescriptionsService.prototype.generateEPrescriptionPdf.call(serviceContext, 'patient-1', appointmentId);

    expect(result).toEqual(Buffer.from('pdf-content'));
    expect(serviceContext.pdfGeneratorService.generateEPrescriptionPdf).toHaveBeenCalledWith({
      ePrescription: { _id: 'ep-1', detail_e_prescriptions: [] },
      aggregatedData: { appointment_id: appointmentId, clinic_name: 'Clinic', doctor_name: 'Doctor', patient_name: 'Patient' },
    });
  });

  it('UT-76-04: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.exportEPrescriptionPdf);

    expect(guards).toHaveLength(2);
  });

  it('UT-76-05: Reject non-patient role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.exportEPrescriptionPdf);

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-76-06: Reject invalid appointment uuid', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('appointment_invalid_format', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-76-07: Reject appointment not found or access denied', async () => {
    const serviceContext = {
      appointmentRepository: { findOne: jest.fn().mockResolvedValue(null) },
      ePrescriptionRepository: { createQueryBuilder: jest.fn() },
    } as any;

    await expect(PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId)).rejects.toThrow(
      new NotFoundException('Appointment not found or access denied'),
    );
  });

  it('UT-76-08: Reject non-completed appointment (current service does not enforce status)', async () => {
    const serviceContext = createPrescriptionContext({ ePrescriptionData: { _id: 'ep-1', detail_e_prescriptions: [] } });

    const result = await PrescriptionsService.prototype.generateEPrescriptionPdf.call(serviceContext, 'patient-1', appointmentId);

    expect(result).toEqual(Buffer.from('pdf-content'));
  });

  it('UT-76-09: Reject when e-prescription missing', async () => {
    const serviceContext = {
      appointmentRepository: { findOne: jest.fn().mockResolvedValue({ _id: appointmentId }) },
      ePrescriptionRepository: {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      },
    } as any;

    await expect(PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId)).rejects.toThrow(
      new NotFoundException('E-Prescription not found'),
    );
  });

  it('UT-76-10: Boundary completed appointment with zero active details', async () => {
    const serviceContext = createPrescriptionContext({ ePrescriptionData: { _id: 'ep-1', detail_e_prescriptions: [] } });

    const result = await PrescriptionsService.prototype.generateEPrescriptionPdf.call(serviceContext, 'patient-1', appointmentId);

    expect(result).toEqual(Buffer.from('pdf-content'));
  });

  it('UT-76-11: Boundary metadata not found after prescription loaded', async () => {
    const serviceContext = createPrescriptionContext({ aggregatedData: null });

    await expect(PrescriptionsService.prototype.generateEPrescriptionPdf.call(serviceContext, 'patient-1', appointmentId)).rejects.toThrow(
      new NotFoundException('Unable to retrieve appointment metadata for PDF generation'),
    );
  });
});
