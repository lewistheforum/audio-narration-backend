import { ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { FeedbackController } from '../../../../src/modules/reports/feedback.controller';
import { FeedbackAIResponseDto } from '../../../../src/modules/reports/dto/response-ai-feedback.dto';
import { FeedbackService } from '../../../../src/modules/reports/feedback.service';

describe('UC-37 View Public Reviews', () => {
  const feedback = {
    _id: 'feedback-1',
    clinicId: 'clinic-1',
    doctorId: 'doctor-1',
    rating: 5,
    description: 'Great experience',
    feedbackImages: ['https://example.com/image.jpg'],
    descriptionLabel: [{ label: 'Positive' }],
    feedbackImagesLabel: [{ label: 'Clean' }],
    doctor: {
      username: 'doctor.user',
      email: 'doctor@example.com',
      doctorInformation: {
        fullName: 'Dr. John Smith',
      },
    },
  } as any;

  it('UT-37-01: View clinic feedback list successfully.', async () => {
    const controllerContext = {
      feedbackService: {
        findAllFeedbacksById: jest.fn().mockResolvedValue([feedback]),
      },
    } as any;

    const result = await FeedbackController.prototype.getFeedbacks.call(
      controllerContext,
      'clinic-1',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(FeedbackAIResponseDto);
    expect(result[0]).toMatchObject({
      id: 'feedback-1',
      clinicId: 'clinic-1',
      rating: 5,
    });
  });

  it('UT-37-02: View doctor feedback list successfully.', async () => {
    const controllerContext = {
      feedbackService: {
        findFeedbacksByDoctorId: jest.fn().mockResolvedValue([feedback]),
      },
    } as any;

    const result = await FeedbackController.prototype.getFeedbacksByDoctorId.call(
      controllerContext,
      '123e4567-e89b-12d3-a456-426614174001',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(FeedbackAIResponseDto);
    expect(result[0]).toMatchObject({
      doctorId: 'doctor-1',
      doctorFullName: 'Dr. John Smith',
      doctorEmail: 'doctor@example.com',
    });
  });

  it('UT-37-03: View review list successfully while authenticated token is ignored.', () => {
    const clinicGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      FeedbackController.prototype.getFeedbacks,
    );
    const doctorGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      FeedbackController.prototype.getFeedbacksByDoctorId,
    );

    expect(clinicGuards).toBeUndefined();
    expect(doctorGuards).toBeUndefined();
  });

  it('UT-37-04: Reject invalid doctor UUID format.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-37-05: Return empty list when entity has no feedbacks.', async () => {
    const controllerContext = {
      feedbackService: {
        findAllFeedbacksById: jest.fn().mockResolvedValue([]),
        findFeedbacksByDoctorId: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const clinicResult = await FeedbackController.prototype.getFeedbacks.call(
      controllerContext,
      'clinic-without-feedbacks',
    );
    const doctorResult = await FeedbackController.prototype.getFeedbacksByDoctorId.call(
      controllerContext,
      '123e4567-e89b-12d3-a456-426614174099',
    );

    expect(clinicResult).toEqual([]);
    expect(doctorResult).toEqual([]);
  });

  it('UT-37-06: Bubble repository failure as internal server error.', async () => {
    const serviceContext = {
      feedbackRepository: {
        findFeedbacksByDoctorId: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(
      FeedbackService.prototype.findFeedbacksByDoctorId.call(
        serviceContext,
        '123e4567-e89b-12d3-a456-426614174001',
      ),
    ).rejects.toThrow('db failed');
  });
});
