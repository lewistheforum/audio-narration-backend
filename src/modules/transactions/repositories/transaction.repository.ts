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
              ga.dob        AS sender_dob
       FROM transactions t
      LEFT JOIN clinic_admin_information cai ON cai._id = t.clinic_id
      LEFT JOIN general_accounts ga ON ga.account_id = t.sender_account_id
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
    async countPaymentHistory(
        filters?: {
            clinicId?: string;
            senderAccountId?: string;
            fromDate?: string;
            toDate?: string;
        },
    ): Promise<number> {
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
              ga.dob        AS sender_dob
       FROM transactions t
      LEFT JOIN clinic_admin_information cai ON cai._id = t.clinic_id
      LEFT JOIN general_accounts ga ON ga.account_id = t.sender_account_id
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
}
