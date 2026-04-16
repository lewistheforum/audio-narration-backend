import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums';
import { FeedbackController } from '../../../../src/modules/reports/feedback.controller';
import { DoctorFeedbacksQueryDto } from '../../../../src/modules/reports/dto/doctor-feedbacks-query.dto';
import { FeedbackService } from '../../../../src/modules/reports/feedback.service';

describe('UC-46 View Doctor Reviews', () => {
  const createServiceContext = () => ({
    dataSource: {
      query: jest.fn(),
    },
  }) as any;

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(DoctorFeedbacksQueryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-46-01: View own feedback list successfully with default query.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([
        {
          feedback_id: 'feedback-1',
          rating: 5,
          description: 'Excellent doctor',
          description_label: null,
          feedback_images: null,
          feedback_images_label: null,
          patient_id: 'patient-1',
          patient_name: 'Patient One',
          patient_image: null,
          patient_gender: 'MALE',
          appointment_id: 'appointment-1',
          appointment_date: '2026-01-15',
          clinic_name: 'Clinic A',
          created_at: '2026-01-16T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          avg_rating: '5.00',
          rating_5: '1',
          rating_4: '0',
          rating_3: '0',
          rating_2: '0',
          rating_1: '0',
        },
      ]);

    const result = await FeedbackService.prototype.getDoctorFeedbacks.call(
      serviceContext,
      'doctor-1',
      {},
    );

    expect(serviceContext.dataSource.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT COUNT(*) as total'),
      ['doctor-1', 20, 0],
    );
    expect(result.average_rating).toBe(5);
    expect(result.feedbacks[0].patient.full_name).toBe('Patient One');
  });

  it('UT-46-02: View own feedback list successfully with min_rating filter.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          avg_rating: '4.00',
          rating_5: '0',
          rating_4: '1',
          rating_3: '0',
          rating_2: '0',
          rating_1: '0',
        },
      ]);

    const result = await FeedbackService.prototype.getDoctorFeedbacks.call(
      serviceContext,
      'doctor-1',
      { min_rating: 4 },
    );

    expect(serviceContext.dataSource.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('f.rating >= $2'),
      ['doctor-1', 4, 20, 0],
    );
    expect(result.total).toBe(1);
  });

  it('UT-46-03: View own feedback list successfully with search and rating sort.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          avg_rating: '4.50',
          rating_5: '1',
          rating_4: '0',
          rating_3: '0',
          rating_2: '0',
          rating_1: '0',
        },
      ]);

    const result = await FeedbackService.prototype.getDoctorFeedbacks.call(
      serviceContext,
      'doctor-1',
      { sort_by: 'rating', order: 'ASC', search: 'excellent' },
    );

    expect(serviceContext.dataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ORDER BY f.rating ASC'),
      ['doctor-1', '%excellent%', 20, 0],
    );
    expect(result.average_rating).toBe(4.5);
  });

  it('UT-46-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      FeedbackController.prototype.getDoctorFeedbacks,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-46-05: Reject authenticated non-doctor role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, FeedbackController.prototype.getDoctorFeedbacks);

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-46-06: Reject invalid query DTO values.', async () => {
    const messages = await collectMessages({
      page: 0,
      limit: 101,
      sort_by: 'INVALID',
      order: 'INVALID',
      min_rating: 6,
      search: 123,
    });
    const lowMessages = await collectMessages({ min_rating: 0, limit: 0 });

    expect(messages).toContain('page must not be less than 1');
    expect(lowMessages).toContain('limit must not be less than 1');
    expect(messages).toContain('limit must not be greater than 100');
    expect(messages).toContain('sort_by must be one of the following values: ');
    expect(messages).toContain('order must be one of the following values: ');
    expect(lowMessages).toContain('min_rating must not be less than 1');
    expect(messages).toContain('min_rating must not be greater than 5');
    expect(messages).toContain('search must be a string');
  });

  it('UT-46-07: Return zero-stat empty result when doctor has no feedbacks.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          avg_rating: null,
          rating_5: '0',
          rating_4: '0',
          rating_3: '0',
          rating_2: '0',
          rating_1: '0',
        },
      ]);

    const result = await FeedbackService.prototype.getDoctorFeedbacks.call(
      serviceContext,
      'doctor-1',
      {},
    );

    expect(result).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
      average_rating: 0,
      rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      feedbacks: [],
    });
  });

  it('UT-46-08: Return empty page when page exceeds available data.', async () => {
    const controllerContext = {
      feedbackService: {
        getDoctorFeedbacks: jest.fn().mockResolvedValue({
          total: 1,
          page: 999,
          limit: 20,
          total_pages: 1,
          average_rating: 5,
          rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 },
          feedbacks: [],
        }),
      },
    } as any;

    const result = await FeedbackController.prototype.getDoctorFeedbacks.call(
      controllerContext,
      { user: { _id: 'doctor-1' } },
      { page: 999 },
    );

    expect(controllerContext.feedbackService.getDoctorFeedbacks).toHaveBeenCalledWith('doctor-1', {
      page: 999,
    });
    expect(result.feedbacks).toEqual([]);
  });
});
