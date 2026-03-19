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
      .andWhere('appointment.status NOT IN (:...excludedStatuses)', {
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
   */
  async getDoctorsWorkingAndFeedback(managerId: string, date: string) {
    // 1. Find all doctors who have appointments in this clinic on this date
    const doctorsData = await this.dataSource.query(`
      SELECT DISTINCT 
        acc._id as "doctorId",
        ga.full_name as "fullName",
        ga.profile_picture as "profilePicture"
      FROM appointments apt
      JOIN accounts acc ON acc._id = apt.doctor_id
      LEFT JOIN general_accounts ga ON ga.account_id = acc._id
      WHERE apt.clinic_id = $1 
        AND apt.appointment_date = $2
        AND apt.status NOT IN ('CANCELLED', 'ABSENT')
    `, [managerId, date]);

    // 2. For each doctor, calculate their average rating and get recent feedbacks
    const result = await Promise.all(
      doctorsData.map(async (doc: any) => {
        const stats = await this.dataSource.query(`
          SELECT 
            AVG(rating)::NUMERIC(3,2) as "avgRating",
            COUNT(*) as "totalFeedback"
          FROM feedbacks
          WHERE doctor_id = $1 AND type = 'DOCTOR'
        `, [doc.doctorId]);

        const recentFeedbacks = await this.dataSource.query(`
          SELECT 
            f.rating,
            f.description,
            ga.full_name as "patientName"
          FROM feedbacks f
          LEFT JOIN appointments apt ON apt._id = f.appointment_id
          LEFT JOIN accounts acc ON acc._id = apt.patient_id
          LEFT JOIN general_accounts ga ON ga.account_id = acc._id
          WHERE f.doctor_id = $1 AND f.type = 'DOCTOR'
          ORDER BY f.created_at DESC
          LIMIT 5
        `, [doc.doctorId]);

        return {
          ...doc,
          avgRating: parseFloat(stats[0]?.avgRating || '0'),
          totalFeedback: parseInt(stats[0]?.totalFeedback || '0', 10),
          recentFeedbacks,
        };
      })
    );

    return result;
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
