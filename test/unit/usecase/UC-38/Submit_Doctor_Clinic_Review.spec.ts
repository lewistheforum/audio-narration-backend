import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { FeedbackController } from '../../../../src/modules/reports/feedback.controller';
import { CreateFeedbackClinicDto } from '../../../../src/modules/reports/dto/create-feedback-clinic.dto';
import { CreateFeedbackDoctorDto } from '../../../../src/modules/reports/dto/create-feedback-doctor.dto';
import { FeedbackResponseDto } from '../../../../src/modules/reports/dto/response-feedback.dto';
import { FeedbackType } from '../../../../src/modules/reports/enums';
import { FeedbackService } from '../../../../src/modules/reports/feedback.service';

describe('UC-38 Submit Doctor/Clinic Review', () => {
  const baseFeedback = {
    _id: 'feedback-1',
    appointmentId: '123e4567-e89b-42d3-a456-426614174000',
    clinicId: '123e4567-e89b-42d3-a456-426614174001',
    doctorId: '123e4567-e89b-42d3-a456-426614174002',
    rating: 5,
    description: 'Great experience',
    feedbackImages: undefined,
    type: FeedbackType.DOCTOR,
    createdAt: new Date('2099-01-10T12:30:00.000Z'),
    updatedAt: new Date('2099-01-10T12:30:00.000Z'),
  } as any;

  const collectMessages = async (dto: object, cls: new () => any) => {
    const errors = await validate(plainToInstance(cls, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-38-01: Submit clinic review successfully.', async () => {
    const controllerContext = {
      feedbackService: {
        createFeedbackForClinic: jest.fn().mockResolvedValue({
          ...baseFeedback,
          doctorId: undefined,
          type: FeedbackType.CLINIC,
        }),
      },
    } as any;

    const result = await FeedbackController.prototype.createFeedbackForClinic.call(
      controllerContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        rating: 5,
        description: 'Great experience',
      },
    );

    expect(result).toBeInstanceOf(FeedbackResponseDto);
    expect(result).toMatchObject({
      clinicId: baseFeedback.clinicId,
      rating: 5,
      type: FeedbackType.CLINIC,
    });
  });

  it('UT-38-02: Submit doctor review successfully.', async () => {
    const controllerContext = {
      feedbackService: {
        createFeedbackForDoctor: jest.fn().mockResolvedValue(baseFeedback),
      },
    } as any;

    const result = await FeedbackController.prototype.createFeedbackForDoctor.call(
      controllerContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: baseFeedback.doctorId,
        rating: 5,
        description: 'Great experience',
      },
    );

    expect(result).toBeInstanceOf(FeedbackResponseDto);
    expect(result).toMatchObject({
      doctorId: baseFeedback.doctorId,
      type: FeedbackType.DOCTOR,
    });
  });

  it('UT-38-03: Submit review successfully with optional feedback images.', async () => {
    const controllerContext = {
      feedbackService: {
        createFeedbackForDoctor: jest.fn().mockResolvedValue({
          ...baseFeedback,
          feedbackImages: ['https://example.com/image1.jpg'],
        }),
      },
    } as any;

    const result = await FeedbackController.prototype.createFeedbackForDoctor.call(
      controllerContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: baseFeedback.doctorId,
        rating: 5,
        description: 'Great experience',
        feedbackImages: ['https://example.com/image1.jpg'],
      },
    );

    expect(result).toMatchObject({
      feedbackImages: ['https://example.com/image1.jpg'],
    });
  });

  it('UT-38-04: Reject toxic description.', async () => {
    const serviceContext = {
      detectBadWords: jest.fn().mockResolvedValue({
        data: { is_toxic: true, categories: ['abuse'] },
      }),
      feedbackRepository: {
        createFeedback: jest.fn(),
        saveFeedback: jest.fn(),
      },
      runBackgroundLabeling: jest.fn(),
    } as any;

    const result = await FeedbackService.prototype.createFeedbackForDoctor.call(
      serviceContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: baseFeedback.doctorId,
        rating: 5,
        description: 'toxic words content',
      },
    );

    expect(result).toEqual({
      is_toxic: true,
      detection: { is_toxic: true, categories: ['abuse'] },
    });
    expect(serviceContext.feedbackRepository.saveFeedback).not.toHaveBeenCalled();
  });

  it('UT-38-05: Reject missing or invalid clinic-review required fields.', async () => {
    const messages = await collectMessages(
      {
        appointmentId: 'invalid_uuid',
        clinicId: null,
        rating: 0,
      },
      CreateFeedbackClinicDto,
    );

    expect(messages).toContain('Appointment ID must be a valid UUID');
    expect(messages).toContain('Clinic ID is required');
    expect(messages).toContain('Clinic ID must be a valid UUID');
    expect(messages).toContain('Rating must be at least 1');
  });

  it('UT-38-06: Reject missing or invalid doctor-review required fields.', async () => {
    const messages = await collectMessages(
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: 'invalid_uuid',
        rating: 5,
      },
      CreateFeedbackDoctorDto,
    );
    const missingDoctorMessages = await collectMessages(
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        rating: 5,
      },
      CreateFeedbackDoctorDto,
    );

    expect(messages).toContain('Doctor ID must be a valid UUID');
    expect(missingDoctorMessages).toContain('Doctor ID is required');
  });

  it('UT-38-07: Reject invalid optional field types.', async () => {
    const messages = await collectMessages(
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: baseFeedback.doctorId,
        rating: 5,
        feedbackImages: [123],
      },
      CreateFeedbackDoctorDto,
    );

    expect(messages).toContain('Each feedback image must be a string URL');
    expect(() =>
      plainToInstance(CreateFeedbackDoctorDto, {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: baseFeedback.doctorId,
        rating: 5,
        description: 123,
        feedbackImages: 'text',
      }),
    ).toThrow('value?.trim is not a function');
  });

  it('UT-38-08: Accept clinic review with minimum rating 1.', async () => {
    const serviceContext = {
      detectBadWords: jest.fn().mockResolvedValue({ data: { is_toxic: false } }),
      feedbackRepository: {
        createFeedback: jest.fn().mockImplementation((value) => value),
        saveFeedback: jest.fn().mockImplementation(async (value) => value),
      },
      runBackgroundLabeling: jest.fn(),
    } as any;

    const result = await FeedbackService.prototype.createFeedbackForClinic.call(
      serviceContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        rating: 1,
        description: 'Great experience',
      },
    );

    expect(result).toMatchObject({ rating: 1, type: FeedbackType.CLINIC });
  });

  it('UT-38-09: Accept doctor review with maximum rating 5.', async () => {
    const serviceContext = {
      detectBadWords: jest.fn().mockResolvedValue({ data: { is_toxic: false } }),
      feedbackRepository: {
        createFeedback: jest.fn().mockImplementation((value) => value),
        saveFeedback: jest.fn().mockImplementation(async (value) => value),
      },
      runBackgroundLabeling: jest.fn(),
    } as any;

    const result = await FeedbackService.prototype.createFeedbackForDoctor.call(
      serviceContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        doctorId: baseFeedback.doctorId,
        rating: 5,
        description: 'Great experience',
      },
    );

    expect(result).toMatchObject({ rating: 5, type: FeedbackType.DOCTOR });
  });

  it('UT-38-10: Accept review with empty optional description omitted.', async () => {
    const serviceContext = {
      feedbackRepository: {
        createFeedback: jest.fn().mockImplementation((value) => value),
        saveFeedback: jest.fn().mockImplementation(async (value) => value),
      },
      runBackgroundLabeling: jest.fn(),
    } as any;

    const result = await FeedbackService.prototype.createFeedbackForClinic.call(
      serviceContext,
      {
        appointmentId: baseFeedback.appointmentId,
        clinicId: baseFeedback.clinicId,
        rating: 5,
      },
    );

    expect(result).toMatchObject({
      appointmentId: baseFeedback.appointmentId,
      clinicId: baseFeedback.clinicId,
      description: undefined,
    });
  });
});
