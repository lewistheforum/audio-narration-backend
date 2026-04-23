import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Admin Statistics Repository
 *
 * Provides raw SQL queries for admin dashboard statistics
 */
@Injectable()
export class AdminStatisticsRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Query 1: Get income statistics by year (with optional service filter)
   *
   * Returns monthly income breakdown for a given year
   */
  async getIncomeByYear(
    year: number,
    serviceId?: string,
  ): Promise<
    { month_num: number; month_name: string; total_income: number }[]
  > {
    const serviceFilter = serviceId ? `AND csh.service_id = $2` : '';

    const query = `
      SELECT
        months.month_num,
        TO_CHAR(TO_DATE(months.month_num::text, 'MM'), 'Month') AS month_name,
        COALESCE(SUM(t.amount), 0) AS total_income
      FROM
        generate_series(1, 12) AS months(month_num)
      LEFT JOIN
        transactions t ON EXTRACT(MONTH FROM t.transaction_date) = months.month_num
        AND EXTRACT(YEAR FROM t.transaction_date) = $1
        AND t.status = 'SUCCESS'
        AND t.deleted_at IS NULL
        ${
          serviceId
            ? `
        LEFT JOIN
          clinic_subcriptions_history csh ON t.subcription_id = csh._id
          ${serviceFilter}
        `
            : ''
        }
      GROUP BY
        months.month_num
      ORDER BY
        months.month_num ASC
    `;

    const params = serviceId ? [year, serviceId] : [year];
    return this.dataSource.query(query, params);
  }

  /**
   * Query 2: Get income statistics by month (with optional service filter)
   *
   * Returns daily income breakdown for a given month
   */
  async getIncomeByMonth(
    year: number,
    month: number,
    serviceId?: string,
  ): Promise<{ transaction_date: string; total_income: number }[]> {
    const serviceFilter = serviceId ? `AND ss._id = $3` : '';

    const query = `
      WITH month_range AS (
        SELECT
          MAKE_DATE($1, $2, 1) AS start_date,
          (MAKE_DATE($1, $2, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS end_date
      ),
      calendar AS (
        SELECT generate_series(
          (SELECT start_date FROM month_range),
          (SELECT end_date FROM month_range),
          '1 day'::interval
        )::date AS day
      )
      SELECT
        c.day AS transaction_date,
        COALESCE(SUM(t.amount), 0) AS total_income
      FROM
        calendar c
      LEFT JOIN
        transactions t ON DATE(t.transaction_date) = c.day
        AND t.status = 'SUCCESS'
        AND t.deleted_at IS NULL
      LEFT JOIN
        clinic_subcriptions_history csh ON t.subcription_id = csh._id
      LEFT JOIN
        subcription_services ss ON csh.service_id = ss._id
        ${serviceFilter}
      GROUP BY
        c.day
      ORDER BY
        c.day ASC
    `;

    const params = serviceId ? [year, month, serviceId] : [year, month];
    return this.dataSource.query(query, params);
  }

  /**
   * Query 3: Get clinic count by service for a year
   *
   * Returns number of unique clinics and total subscriptions per service
   */
  async getClinicCountByServiceYear(year: number): Promise<
    {
      service_name: string;
      chart_color: string;
      clinic_count: number;
      subscription_count: number;
    }[]
  > {
    const query = `
      SELECT
        ss.service_name,
        ss.chart_color,
        COUNT(DISTINCT csh.clinic_id) AS clinic_count,
        COUNT(csh._id) AS subscription_count
      FROM
        subcription_services ss
      LEFT JOIN
        clinic_subcriptions_history csh
        ON ss._id = csh.service_id
        AND EXTRACT(YEAR FROM csh.subscription_date) = $1
      GROUP BY
        ss._id, ss.service_name
    `;

    return this.dataSource.query(query, [year]);
  }

  /**
   * Query 4: Get clinic count by service for a month
   *
   * Returns number of unique clinics and total subscriptions per service
   */
  async getClinicCountByServiceMonth(
    year: number,
    month: number,
  ): Promise<
    {
      service_name: string;
      chart_color: string;
      clinic_count: number;
      subscription_count: number;
    }[]
  > {
    const query = `
      SELECT
        ss.service_name,
        ss.chart_color,
        COUNT(DISTINCT csh.clinic_id) AS clinic_count,
        COUNT(csh._id) AS subscription_count
      FROM
        subcription_services ss
      LEFT JOIN
        clinic_subcriptions_history csh
        ON ss._id = csh.service_id
        AND EXTRACT(YEAR FROM csh.subscription_date) = $1
        AND EXTRACT(MONTH FROM csh.subscription_date) = $2
      GROUP BY
        ss._id, ss.service_name
    `;

    return this.dataSource.query(query, [year, month]);
  }

  /**
   * Query 5: Get service usage pie chart data for a year
   *
   * Returns service subscription counts with percentages
   */
  async getServiceUsagePieChartYear(
    year: number,
  ): Promise<
    { service_name: string; subscription_count: number; percentage: number }[]
  > {
    const query = `
      WITH ServiceCounts AS (
        SELECT
          ss.service_name,
          COUNT(csh._id) AS subscription_count
        FROM
          subcription_services ss
        LEFT JOIN
          clinic_subcriptions_history csh
          ON ss._id = csh.service_id
          AND EXTRACT(YEAR FROM csh.subscription_date) = $1
        GROUP BY
          ss._id, ss.service_name
      )
      SELECT
        service_name,
        subscription_count,
        ROUND(
          (subscription_count * 100.0) / NULLIF(SUM(subscription_count) OVER (), 0),
          2
        ) AS percentage
      FROM
        ServiceCounts
      ORDER BY
        subscription_count DESC
    `;

    return this.dataSource.query(query, [year]);
  }

  /**
   * Query 6: Get service usage pie chart data for a month
   *
   * Returns service subscription counts with percentages
   */
  async getServiceUsagePieChartMonth(
    year: number,
    month: number,
  ): Promise<
    { service_name: string; subscription_count: number; percentage: number }[]
  > {
    const query = `
      SELECT
        ss.service_name,
        COUNT(csh._id) AS subscription_count,
        ROUND(
          COALESCE(
            (COUNT(csh._id) * 100.0) / NULLIF(SUM(COUNT(csh._id)) OVER (), 0),
            0
          ),
          2
        ) AS percentage
      FROM
        subcription_services ss
      LEFT JOIN
        clinic_subcriptions_history csh
        ON ss._id = csh.service_id
        AND EXTRACT(YEAR FROM csh.subscription_date) = $1
        AND EXTRACT(MONTH FROM csh.subscription_date) = $2
      GROUP BY
        ss._id, ss.service_name
      ORDER BY
        subscription_count DESC
    `;

    return this.dataSource.query(query, [year, month]);
  }

  /**
   * Query 7: Get top 10 popular clinics for a year
   *
   * Returns top clinics by appointment count with completion rate
   */
  async getTopClinicsYear(year: number): Promise<
    {
      year: number;
      clinic_name: string;
      branch_name: string;
      appointment_count: number;
      completion_rate: number;
    }[]
  > {
    const query = `
      WITH TopClinics AS (
        SELECT
          app.clinic_id
        FROM
          appointments app
        WHERE EXTRACT(YEAR FROM app.appointment_date) = $1
        GROUP BY
          app.clinic_id
        ORDER BY
          COUNT(app._id) DESC
        LIMIT 10
      )
      SELECT
        EXTRACT(YEAR FROM app.appointment_date) AS year,
        COALESCE(cai.clinic_name, 'Unknown Clinic (' || a2._id || ')') AS clinic_name,
        COALESCE(cmi.clinic_branch_name, 'Unknown Branch (' || app.clinic_id || ')') AS branch_name,
        COUNT(app._id) AS appointment_count,
        ROUND(
          (SUM(CASE WHEN app.status = 'COMPLETED' THEN 1 ELSE 0 END) * 100.0) /
          NULLIF(COUNT(app._id), 0),
          2
        ) AS completion_rate
      FROM
        appointments app
      JOIN
        accounts a1 ON a1._id = app.clinic_id
      LEFT JOIN
        clinic_manager_information cmi ON cmi.account_id = a1._id
      LEFT JOIN
        accounts a2 ON a2._id = a1.parent_id
      LEFT JOIN
        clinic_admin_information cai ON cai.account_id = a2._id
      INNER JOIN
        TopClinics tc ON app.clinic_id = tc.clinic_id
      WHERE
        EXTRACT(YEAR FROM app.appointment_date) = $1
      GROUP BY
        EXTRACT(YEAR FROM app.appointment_date),
        cai.clinic_name,
        cmi.clinic_branch_name,
        app.clinic_id,
        a2._id
      ORDER BY
        appointment_count DESC
    `;

    return this.dataSource.query(query, [year]);
  }

  /**
   * Query 8: Get top 10 popular clinics for a month
   *
   * Returns top clinics by appointment count with completion rate
   */
  async getTopClinicsMonth(
    year: number,
    month: number,
  ): Promise<
    {
      year: number;
      month: number;
      clinic_name: string;
      branch_name: string;
      appointment_count: number;
      completion_rate: number;
    }[]
  > {
    const query = `
      WITH TopClinics AS (
        SELECT
          app.clinic_id
        FROM
          appointments app
        WHERE EXTRACT(YEAR FROM app.appointment_date) = $1
          AND EXTRACT(MONTH FROM app.appointment_date) = $2
        GROUP BY
          app.clinic_id
        ORDER BY
          COUNT(app._id) DESC
        LIMIT 10
      )
      SELECT
        EXTRACT(YEAR FROM app.appointment_date) AS year,
        EXTRACT(MONTH FROM app.appointment_date) AS month,
        COALESCE(cai.clinic_name, 'Unknown Clinic (' || a2._id || ')') AS clinic_name,
        COALESCE(cmi.clinic_branch_name, 'Unknown Branch (' || app.clinic_id || ')') AS branch_name,
        COUNT(app._id) AS appointment_count,
        ROUND(
          (SUM(CASE WHEN app.status = 'COMPLETED' THEN 1 ELSE 0 END) * 100.0) /
          NULLIF(COUNT(app._id), 0),
          2
        ) AS completion_rate
      FROM
        appointments app
      JOIN
        accounts a1 ON a1._id = app.clinic_id
      LEFT JOIN
        clinic_manager_information cmi ON cmi.account_id = a1._id
      LEFT JOIN
        accounts a2 ON a2._id = a1.parent_id
      LEFT JOIN
        clinic_admin_information cai ON cai.account_id = a2._id
      INNER JOIN
        TopClinics tc ON app.clinic_id = tc.clinic_id
      WHERE
        EXTRACT(YEAR FROM app.appointment_date) = $1
        AND EXTRACT(MONTH FROM app.appointment_date) = $2
      GROUP BY
        EXTRACT(YEAR FROM app.appointment_date),
        EXTRACT(MONTH FROM app.appointment_date),
        cai.clinic_name,
        cmi.clinic_branch_name,
        app.clinic_id,
        a2._id
      ORDER BY
        appointment_count DESC
    `;

    return this.dataSource.query(query, [year, month]);
  }

  /**
   * Query 9: Get clinic spending statistics for a year
   *
   * Returns clinic spending on system services
   */
  async getClinicSpendingYear(year: number): Promise<
    {
      clinic_name: string;
      transaction_count: number;
      total_extra_spent: number;
    }[]
  > {
    const query = `
      SELECT
        cai.clinic_name,
        COUNT(t.clinic_id) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_extra_spent
      FROM
        transactions t
      LEFT JOIN
        clinic_admin_information cai ON t.clinic_id = cai.account_id
      WHERE
        t.status = 'SUCCESS'
        AND EXTRACT(YEAR FROM t.transaction_date) = $1
      GROUP BY
        cai.account_id, cai.clinic_name
      ORDER BY
        total_extra_spent DESC
    `;

    return this.dataSource.query(query, [year]);
  }

  /**
   * Query 10: Get clinic spending statistics for a month
   *
   * Returns clinic spending on system services
   */
  async getClinicSpendingMonth(
    year: number,
    month: number,
  ): Promise<
    {
      clinic_name: string;
      transaction_count: number;
      total_extra_spent: number;
    }[]
  > {
    const query = `
      SELECT
        cai.clinic_name,
        COUNT(t.clinic_id) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_extra_spent
      FROM
        transactions t
      LEFT JOIN
        clinic_admin_information cai ON t.clinic_id = cai.account_id
      WHERE
        t.status = 'SUCCESS'
        AND EXTRACT(MONTH FROM t.transaction_date) = $2
        AND EXTRACT(YEAR FROM t.transaction_date) = $1
      GROUP BY
        cai.account_id, cai.clinic_name
      ORDER BY
        total_extra_spent DESC
    `;

    return this.dataSource.query(query, [year, month]);
  }

  /**
   * Query 11: Get transaction log for a specific clinic
   *
   * Returns detailed transaction history for a clinic
   */
  async getClinicTransactionLog(clinicId: string): Promise<
    {
      transaction_id: string;
      transaction_date: Date;
      amount: number;
      currency: string;
      status: string;
      gateway: string;
      transaction_code: string;
      service_name: string;
      subscription_start: Date;
      subscription_end: Date;
    }[]
  > {
    const query = `
      SELECT
        t._id AS transaction_id,
        t.transaction_date,
        t.amount,
        t.currency,
        t.status,
        t.gateway,
        t.code AS transaction_code,
        ss.service_name,
        csh.subscription_date AS subscription_start,
        csh.expiration_date AS subscription_end
      FROM
        transactions t
      JOIN
        clinic_subcriptions_history csh ON t._id = csh.transaction_id
      JOIN
        subcription_services ss ON csh.service_id = ss._id
      WHERE
        t.clinic_id = $1
      ORDER BY
        t.transaction_date DESC
    `;

    return this.dataSource.query(query, [clinicId]);
  }

  /**
   * Query 12: Get clinics with longest system usage
   *
   * Returns clinics ranked by duration of system usage
   */
  async getLongestUsingClinics(): Promise<
    {
      clinic_name: string;
      transaction_count: number;
      total_spent: number;
      time_using_system: string;
    }[]
  > {
    const query = `
      SELECT
        cai.clinic_name,
        COUNT(t._id) AS transaction_count,
        COALESCE(SUM(t.amount), 0) AS total_spent,
        CASE
          WHEN MAX(t.transaction_date) = MIN(t.transaction_date) THEN 'New'
          ELSE
            TRIM(BOTH FROM
              CASE
                WHEN EXTRACT(YEAR FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) > 0
                THEN EXTRACT(YEAR FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) || 
                  CASE WHEN EXTRACT(YEAR FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) > 1 THEN ' years ' ELSE ' year ' END
                ELSE ''
              END ||
              CASE
                WHEN EXTRACT(MONTH FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) > 0
                THEN EXTRACT(MONTH FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) || 
                  CASE WHEN EXTRACT(MONTH FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) > 1 THEN ' months' ELSE ' month' END
                ELSE ''
              END ||
              CASE
                WHEN EXTRACT(YEAR FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) = 0
                AND EXTRACT(MONTH FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) = 0
                THEN
                  CASE
                    WHEN EXTRACT(DAY FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) > 0
                    THEN EXTRACT(DAY FROM AGE(MAX(t.transaction_date), MIN(t.transaction_date))) || ' days'
                    ELSE 'New'
                  END
                ELSE ''
              END
            )
        END AS time_using_system
      FROM
        transactions t
      JOIN
        clinic_admin_information cai ON t.clinic_id = cai.account_id
      WHERE
        t.status = 'SUCCESS'
      GROUP BY
        cai.account_id, cai.clinic_name
      ORDER BY
        total_spent DESC
    `;

    return this.dataSource.query(query);
  }
}
