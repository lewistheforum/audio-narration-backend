import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Feedback } from './entities/feedback.entity';
import { AppointmentStatus } from '../appointments/enums';
import { BranchReportQueryDto, ReportPeriod } from './dto/branch-report-query.dto';
import { Account } from '../accounts/entities/accounts.entity';

@Injectable()
export class BranchReportService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get total customers grouped by period
   */
  async getCustomerStats(managerId: string, query: BranchReportQueryDto) {
    const { startDate, endDate, period = ReportPeriod.DAY } = query;

    let dateGroupBy: string;
    switch (period) {
      case ReportPeriod.YEAR:
        dateGroupBy = "TO_CHAR(appointment_date, 'YYYY')";
        break;
      case ReportPeriod.MONTH:
        dateGroupBy = "TO_CHAR(appointment_date, 'YYYY-MM')";
        break;
      default:
        dateGroupBy = "TO_CHAR(appointment_date, 'YYYY-MM-DD')";
    }

    const queryBuilder = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .select(dateGroupBy, 'label')
      .addSelect('COUNT(DISTINCT appointment.patientId)', 'count')
      .where('appointment.clinicId = :managerId', { managerId })
      .andWhere('NOT appointment.status = ANY(:excludedStatuses)', {
        excludedStatuses: [AppointmentStatus.CANCELLED, AppointmentStatus.ABSENT],
      });

    if (startDate) {
      queryBuilder.andWhere('appointment.appointment_date >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('appointment.appointment_date <= :endDate', { endDate });
    }

    return queryBuilder.groupBy(dateGroupBy).orderBy('label', 'ASC').getRawMany();
  }

  /**
   * Get doctors working on a specific day and their feedback stats
   * OPTIMIZED: Uses single LEFT JOIN query with aggregation instead of N+1
   */
  async getDoctorsWorkingAndFeedback(managerId: string, date: string) {
    // Single query: Get doctors with stats using LEFT JOINs and aggregation
    const doctorsWithStats = await this.dataSource.query(`
      SELECT 
        acc._id as "doctorId",
        ga.full_name as "fullName",
        ga.profile_picture as "profilePicture",
        COALESCE(AVG(fb.rating)::NUMERIC(3,2), 0) as "avgRating",
        COUNT(fb._id) as "totalFeedback"
      FROM appointments apt
      JOIN accounts acc ON acc._id = apt.doctor_id
      LEFT JOIN general_accounts ga ON ga.account_id = acc._id
      LEFT JOIN feedbacks fb ON fb.doctor_id = acc._id AND fb.type = 'DOCTOR'
      WHERE apt.clinic_id = $1 
        AND apt.appointment_date = $2
        AND apt.status NOT IN ('CANCELLED', 'ABSENT')
      GROUP BY acc._id, ga.full_name, ga.profile_picture
      ORDER BY ga.full_name ASC
    `, [managerId, date]);

    if (doctorsWithStats.length === 0) {
      return [];
    }

    // Get all doctor IDs for the recent feedbacks query
    const doctorIds = doctorsWithStats.map((d: { doctorId: string }) => d.doctorId);

    // Single query for recent feedbacks for all doctors
    const recentFeedbacksRaw = await this.dataSource.query(`
      SELECT 
        fb.doctor_id as "doctorId",
        fb.rating,
        fb.description,
        ga.full_name as "patientName"
      FROM feedbacks fb
      LEFT JOIN appointments apt ON apt._id = fb.appointment_id
      LEFT JOIN accounts acc ON acc._id = apt.patient_id
      LEFT JOIN general_accounts ga ON ga.account_id = acc._id
      WHERE fb.doctor_id = ANY($1) AND fb.type = 'DOCTOR'
      ORDER BY fb.created_at DESC
    `, [doctorIds]);

    // Group recent feedbacks by doctorId
    const feedbacksByDoctor = new Map<string, Array<{
      rating: number;
      description: string | null;
      patientName: string | null;
    }>>();

    for (const fb of recentFeedbacksRaw) {
      if (!feedbacksByDoctor.has(fb.doctorId)) {
        feedbacksByDoctor.set(fb.doctorId, []);
      }
      if (feedbacksByDoctor.get(fb.doctorId)!.length < 5) {
        feedbacksByDoctor.get(fb.doctorId)!.push({
          rating: fb.rating,
          description: fb.description,
          patientName: fb.patientName,
        });
      }
    }

    // Map results
    return doctorsWithStats.map((doc: { doctorId: string; fullName: string | null; profilePicture: string | null; avgRating: string; totalFeedback: string }) => ({
      doctorId: doc.doctorId,
      fullName: doc.fullName,
      profilePicture: doc.profilePicture,
      avgRating: parseFloat(doc.avgRating || '0'),
      totalFeedback: parseInt(doc.totalFeedback || '0', 10),
      recentFeedbacks: feedbacksByDoctor.get(doc.doctorId) || [],
    }));
  }

  /**
   * Get service statistics (registrations and revenue)
   */
  async getServiceStats(managerId: string, query: BranchReportQueryDto) {
    const { startDate, endDate } = query;

    const sql = `
      SELECT 
        cs.service_name as "serviceName",
        COUNT(sa._id) as "registrationCount",
        SUM(sa.price * (1 - sa.discount / 100)) as "totalRevenue"
      FROM service_appointments sa
      JOIN appointment_package ap ON ap._id = sa.appointment_package_id
      JOIN appointments apt ON apt._id = ap.appointment_id
      JOIN clinic_service_config csc ON csc._id = sa.clinic_service_id
      JOIN clinic_services cs ON cs._id = csc.service_id
      WHERE apt.clinic_id = $1
        AND apt.status NOT IN ('CANCELLED', 'ABSENT')
        ${startDate ? 'AND apt.appointment_date >= $2' : ''}
        ${endDate ? 'AND apt.appointment_date <= ' + (startDate ? '$3' : '$2') : ''}
      GROUP BY cs.service_name
      ORDER BY "registrationCount" DESC
    `;

    const params: any[] = [managerId];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);

    const data = await this.dataSource.query(sql, params);
    
    return data.map(item => ({
      ...item,
      registrationCount: parseInt(item.registrationCount, 10),
      totalRevenue: parseFloat(item.totalRevenue || '0'),
    }));
  }
}
