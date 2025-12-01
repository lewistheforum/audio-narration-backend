import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

export enum PaymentStatus {
	PENDING = 'PENDING',
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
	EXPIRED = 'EXPIRED',
}

export enum PaymentDirection {
	IN = 'in',
	OUT = 'out',
}

@Entity('payment_transactions')
@Index('IDX_payment_order_code', ['orderCode'], { unique: true })
export class PaymentTransaction {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'prescription_id', type: 'uuid', nullable: true })
	prescriptionId?: string;

	@Column({ name: 'order_code', length: 64 })
	orderCode: string;

	@Column({ type: 'bigint' })
	amount: number;

	@Column({ length: 10, default: 'VND' })
	currency: string;

	@Column({ name: 'qr_code_url', type: 'text', nullable: true })
	qrCodeUrl?: string;

	@Column({ name: 'qr_payload', type: 'text', nullable: true })
	qrPayload?: string;

	@Column({
		type: 'enum',
		enum: PaymentStatus,
		default: PaymentStatus.PENDING,
	})
	status: PaymentStatus;

	@Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
	expiresAt?: Date;

	@Column({
		name: 'seepay_transaction_id',
		type: 'bigint',
		nullable: true,
	})
	seepayTransactionId?: string;

	@Column({ length: 100, nullable: true })
	gateway?: string;

	@Column({ name: 'transaction_date', type: 'timestamptz', nullable: true })
	transactionDate?: Date;

	@Column({ name: 'account_number', length: 50, nullable: true })
	accountNumber?: string;

	@Column({ length: 120, nullable: true })
	code?: string | null;

	@Column({ type: 'text', nullable: true })
	content?: string;

	@Column({
		name: 'transfer_type',
		type: 'enum',
		enum: PaymentDirection,
		nullable: true,
	})
	transferType?: PaymentDirection;

	@Column({ name: 'transfer_amount', type: 'bigint', nullable: true })
	transferAmount?: number;

	@Column({ name: 'accumulated', type: 'bigint', nullable: true })
	accumulated?: number;

	@Column({ name: 'sub_account', length: 50, nullable: true })
	subAccount?: string;

	@Column({ name: 'reference_code', length: 120, nullable: true })
	referenceCode?: string;

	@Column({ type: 'text', nullable: true })
	description?: string;

	@Column({ name: 'metadata', type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt: Date;

	@DeleteDateColumn({ name: 'deleted_at' })
	deletedAt?: Date;
}
