import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../../../src/modules/transactions/transactions.service';
import { TransactionRepository } from '../../../src/modules/transactions/repositories/transaction.repository';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClinicAdminInformation } from '../../../src/modules/accounts/entities/clinic-admin-information.entity';
import { TransactionType } from '../../../src/modules/transactions/entities/transaction-type.entity';
import { Appointment } from '../../../src/modules/appointments/entities/appointment.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from '../../../src/modules/transactions/dto/create-transaction.dto';
import { PaymentDirection, PaymentStatus } from '../../../src/modules/transactions/entities/transaction.entity';
import { SeepayCallbackDto } from '../../../src/modules/transactions/dto/seepay-callback.dto';

// npx jest test/unit/transactions
describe('TransactionsService', () => {
    let service: TransactionsService;
    let transactionRepository: Partial<TransactionRepository>;
    let clinicAdminRepo: any;
    let transactionTypeRepo: any;
    let appointmentRepo: any;
    let configService: any;

    beforeEach(async () => {
        transactionRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAllPaymentHistory: jest.fn(),
            countPaymentHistory: jest.fn(),
            findDetailById: jest.fn(),
        };

        clinicAdminRepo = {
            findOne: jest.fn(),
            update: jest.fn(),
        };

        transactionTypeRepo = {
            findOne: jest.fn(),
        };

        appointmentRepo = {
            findOne: jest.fn(),
        };

        configService = {
            get: jest.fn((key) => {
                if (key === 'SEEPAY_QR_BASE') return 'https://qr.seepay.vn';
                if (key === 'SEEPAY_ACC') return 'SEEPAY_ACC';
                if (key === 'SEEPAY_BANK') return 'SEEPAY_BANK';
                if (key === 'SEEPAY_QR_EXPIRE_MINUTES') return 15;
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionsService,
                {
                    provide: TransactionRepository,
                    useValue: transactionRepository,
                },
                {
                    provide: getRepositoryToken(ClinicAdminInformation),
                    useValue: clinicAdminRepo,
                },
                {
                    provide: getRepositoryToken(TransactionType),
                    useValue: transactionTypeRepo,
                },
                {
                    provide: getRepositoryToken(Appointment),
                    useValue: appointmentRepo,
                },
                {
                    provide: ConfigService,
                    useValue: configService,
                },
            ],
        }).compile();

        service = module.get<TransactionsService>(TransactionsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createDynamicQr', () => {
        it('should create QR successfully if appointment exists', async () => {
            const dto: CreateTransactionDto = {
                prescriptionId: 'uuid-prescription',
                amount: 50000,
            };

            appointmentRepo.findOne.mockResolvedValue({
                _id: 'uuid-prescription',
                total: 50000,
                clinicId: 'uuid-clinic-account',
            });

            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                accountId: 'uuid-clinic-account',
                sepayVa: 'VA123',
                bankName: 'MB',
            });

            const result = await service.createDynamicQr(dto);

            expect(appointmentRepo.findOne).toHaveBeenCalledWith({ where: { _id: dto.prescriptionId } });
            expect(result.amount).toBe(50000);
            expect(result.qrCodeUrl).toContain('amount=50000');
            expect(result.qrCodeUrl).toContain('VA123');
        });

        it('should throw NotFoundException if appointment check fails', async () => {
            appointmentRepo.findOne.mockResolvedValue(null);
            await expect(service.createDynamicQr({ prescriptionId: 'invalid', amount: 100 } as any))
                .rejects.toThrow(NotFoundException);
        });
    });

    describe('createVerificationQr', () => {
        it('should create verification QR successfully', async () => {
            const clinicId = 'uuid-clinic-acc';
            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                accountId: clinicId,
                sepayVa: 'VA123',
                bankName: 'MB',
            });

            transactionTypeRepo.findOne.mockResolvedValue({ _id: 'type-verification', name: 'VERIFICATION' });

            (transactionRepository.create as jest.Mock).mockReturnValue({
                id: 'new-trans-id',
                amount: 10000,
            });

            (transactionRepository.save as jest.Mock).mockResolvedValue({
                id: 'new-trans-id',
                amount: 10000,
                status: PaymentStatus.PENDING,
                createdAt: new Date(),
            });

            const result = await service.createVerificationQr(clinicId);

            expect(transactionRepository.save).toHaveBeenCalled();
            expect(result.amount).toBe(10000);
            expect(result.id).toBe('new-trans-id');
        });
    });

    describe('handleCallback', () => {
        const mockPayload: SeepayCallbackDto = {
            id: 12345,
            gateway: 'VCB',
            transactionDate: '2023-01-01 10:00:00',
            accountNumber: '9999',
            content: 'Payment for abc',
            transferType: PaymentDirection.IN,
            transferAmount: 50000,
            accumulated: 100000,
            referenceCode: 'REF123',
            prescriptionId: 'uuid-prescription',
            currency: 'VND',
        } as any;

        it('should process successful payment for existing transaction', async () => {
            const existingTrans = {
                id: 'uuid-prescription',
                status: PaymentStatus.PENDING,
                clinicId: 'uuid-clinic',
                transactionType: { name: 'ONLINE' },
            };

            (transactionRepository.findOne as jest.Mock).mockResolvedValue(existingTrans);
            (transactionRepository.save as jest.Mock).mockResolvedValue({
                ...existingTrans,
                status: PaymentStatus.SUCCESS,
            });

            const result = await service.handleCallback(mockPayload);

            expect(transactionRepository.findOne).toHaveBeenCalledWith({
                where: { id: mockPayload.prescriptionId },
                relations: ['transactionType'],
            });
            expect(transactionRepository.save).toHaveBeenCalled();
            expect(result.status).toBe(PaymentStatus.SUCCESS);
        });

        it('should update verification status if transaction type is VERIFICATION', async () => {
            const existingTrans = {
                id: 'uuid-prescription',
                status: PaymentStatus.PENDING,
                clinicId: 'uuid-clinic',
                transactionType: { name: 'VERIFICATION' },
            };

            (transactionRepository.findOne as jest.Mock).mockResolvedValue(existingTrans);
            (transactionRepository.save as jest.Mock).mockResolvedValue({
                ...existingTrans,
                status: PaymentStatus.SUCCESS,
            });

            await service.handleCallback(mockPayload);

            expect(clinicAdminRepo.update).toHaveBeenCalledWith(
                { _id: 'uuid-clinic' },
                { isVerify: true }
            );
        });
    });

    describe('getAllPaymentHistory', () => {
        it('should return paginated items', async () => {
            const mockItems = [
                { _id: '1', amount: 100, clinic_name: 'Clinic A' }
            ];
            (transactionRepository.findAllPaymentHistory as jest.Mock).mockResolvedValue(mockItems);
            (transactionRepository.countPaymentHistory as jest.Mock).mockResolvedValue(1);

            const result = await service.getAllPaymentHistory(1, 10);

            expect(result.items.length).toBe(1);
            expect(result.total).toBe(1);
            expect(transactionRepository.findAllPaymentHistory).toHaveBeenCalled();
        });
    });

    describe('getTransactionDetail', () => {
        it('should return detail if found', async () => {
            (transactionRepository.findDetailById as jest.Mock).mockResolvedValue({
                _id: 'trans-id',
                amount: 200,
            });
            const result = await service.getTransactionDetail('trans-id');
            expect(result.id).toBe('trans-id');
            expect(result.amount).toBe(200);
        });

        it('should throw NotFoundException if not found', async () => {
            (transactionRepository.findDetailById as jest.Mock).mockResolvedValue(null);
            await expect(service.getTransactionDetail('invalid')).rejects.toThrow(NotFoundException);
        });
    });
});
