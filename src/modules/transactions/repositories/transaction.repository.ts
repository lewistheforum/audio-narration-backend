import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class TransactionRepository extends Repository<Transaction> {
  constructor(private dataSource: DataSource) {
    super(Transaction, dataSource.createEntityManager());
  }

  /**
   * Get all payment history with pagination and filters
   *
   * @param limit Number of items per page
   * @param offset Number of items to skip
   * @param filters Filter criteria
   * @returns Array of transactions with joined fields
   */
  async findAllPaymentHistory(
    limit: number,
    offset: number,
    filters?: {
      clinicId?: string;
      senderAccountId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<any[]> {
    const { whereClause, params } = this.buildPaymentHistoryQuery(filters);

    return this.query(
      `SELECT t.*,
              cai.clinic_name AS clinic_name,
              ga.full_name  AS sender_full_name,
              ga.dob        AS sender_dob,
              ss.service_name AS service_name
       FROM transactions t
      -- FIX: t.clinic_id stores Account ID, join on cai.account_id (not cai._id)
      LEFT JOIN clinic_admin_information cai ON cai.account_id = t.clinic_id
      LEFT JOIN general_accounts ga ON ga.account_id = t.sender_account_id
      LEFT JOIN clinic_subcriptions_history csh ON csh._id = t.subcription_id
      LEFT JOIN subcription_services ss ON ss._id = csh.service_id
       WHERE ${whereClause}
       ORDER BY t.transaction_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
  }

  /**
   * Count total payment history items matching filters
   *
   * @param filters Filter criteria
   * @returns Total count
   */
  async countPaymentHistory(filters?: {
    clinicId?: string;
    senderAccountId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<number> {
    const { whereClause, params } = this.buildPaymentHistoryQuery(filters);

    const countResult = await this.query(
      `SELECT COUNT(*)::int AS cnt
       FROM transactions t
       WHERE ${whereClause}`,
      params,
    );
    return Number(countResult?.[0]?.cnt || 0);
  }

  /**
   * Get transaction detail with joined info
   *
   * @param id Transaction ID
   * @param clinicId Optional Clinic ID for ownership check
   * @returns Transaction detail row or undefined
   */
  async findDetailById(id: string, clinicId?: string): Promise<any> {
    const params: any[] = [id];
    let query = `SELECT t.*,
              cai.clinic_name AS clinic_name,
              ga.full_name  AS sender_full_name,
              ga.gender     AS sender_gender,
              ga.dob        AS sender_dob,
              ss.service_name AS service_name
       FROM transactions t
      -- FIX: t.clinic_id stores Account ID, join on cai.account_id (not cai._id)
      LEFT JOIN clinic_admin_information cai ON cai.account_id = t.clinic_id
      LEFT JOIN general_accounts ga ON ga.account_id = t.sender_account_id
      LEFT JOIN clinic_subcriptions_history csh ON csh._id = t.subcription_id
      LEFT JOIN subcription_services ss ON ss._id = csh.service_id
       WHERE t.deleted_at IS NULL AND t._id = $1`;

    if (clinicId) {
      params.push(clinicId);
      query += ` AND t.clinic_id = $${params.length}`;
    }

    query += ` LIMIT 1`;

    const rows = await this.query(query, params);
    return rows?.[0];
  }

  private buildPaymentHistoryQuery(filters?: {
    clinicId?: string;
    senderAccountId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const conditions: string[] = ['t.deleted_at IS NULL'];
    const params: Array<string | number | Date> = [];

    if (filters?.clinicId) {
      params.push(filters.clinicId);
      conditions.push(`t.clinic_id = $${params.length}`);
    }

    if (filters?.senderAccountId) {
      params.push(filters.senderAccountId);
      conditions.push(`t.sender_account_id = $${params.length}`);
    }

    if (filters?.fromDate) {
      params.push(new Date(filters.fromDate));
      conditions.push(`t.transaction_date >= $${params.length}`);
    }

    if (filters?.toDate) {
      params.push(new Date(filters.toDate));
      conditions.push(`t.transaction_date <= $${params.length}`);
    }

    return { whereClause: conditions.join(' AND '), params };
  }

  /**
   * Get revenue statistics grouped by period
   *
   * @param clinicId Clinic Account ID
   * @param startDate Filter from date
   * @param endDate Filter to date
   * @param period 'day', 'month', or 'year'
   */
  async getRevenueStats(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    period: string,
  ): Promise<any[]> {
    return this.query(
      `SELECT
          DATE_TRUNC($1, transaction_date) as label,
          SUM(amount)::bigint as total_revenue,
          COUNT(*)::int as transaction_count
       FROM transactions
       WHERE deleted_at IS NULL
         AND clinic_id = $2
         AND status = 'SUCCESS'
         AND transaction_date >= $3
         AND transaction_date <= $4
       GROUP BY label
       ORDER BY label ASC`,
      [period, clinicId, startDate, endDate],
    );
  }

  /**
   * Get raw transactions for export
   *
   * @param clinicId Clinic Account ID
   * @param startDate Filter from date
   * @param endDate Filter to date
   */
  async getTransactionsForExport(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.query(
      `SELECT
          t.transaction_date as date,
          t._id as transaction_id,
          t.amount as amount,
          t.status as status,
          t.gateway as gateway,
          t.description as description,
          ga.full_name as patient_name
       FROM transactions t
       LEFT JOIN general_accounts ga ON ga.account_id = t.sender_account_id
       WHERE t.deleted_at IS NULL
         AND t.clinic_id = $1
         AND t.status = 'SUCCESS'
         AND t.transaction_date >= $2
         AND t.transaction_date <= $3
       ORDER BY t.transaction_date DESC`,
      [clinicId, startDate, endDate],
    );
  }
}
