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
import { ClinicSubscription } from '../../../src/modules/subscriptions/entities/clinic-subscription.entity';
import { SubscriptionService } from '../../../src/modules/subscriptions/entities/subscription-service.entity';
import { SubscriptionServicesService } from '../../../src/modules/subscriptions/subscription-services.service';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';
import { AppointmentPackage } from '../../../src/modules/appointments/entities/appointment-package.entity';
import { AppointmentPackageStatus } from '../../../src/modules/appointments/enums';

/**
 * Unit Tests for TransactionsService
 * Covers all Business Rules (BR) as documented in business_rules.md
 *
 * Run with: npx jest test/unit/transactions
 */
describe('TransactionsService', () => {
    let service: TransactionsService;
    let transactionRepository: Partial<TransactionRepository>;
    let clinicAdminRepo: any;
    let transactionTypeRepo: any;
    let appointmentRepo: any;
    let clinicSubscriptionRepo: any;
    let subscriptionServiceRepo: any;
    let packageRepo: any;
    let subscriptionServicesService: any;
    let configService: any;

    // ========================================
    // SETUP
    // ========================================
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

        clinicSubscriptionRepo = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        subscriptionServiceRepo = {
            findOne: jest.fn(),
        };

        subscriptionServicesService = {
            handleSubscriptionPaymentSuccess: jest.fn(),
        };

        packageRepo = {
            find: jest.fn(),
            update: jest.fn(),
        };

        configService = {
            get: jest.fn((key) => {
                if (key === 'SEEPAY_QR_BASE') return 'https://qr.seepay.vn';
                if (key === 'SEEPAY_ACC') return 'COMPANY_ACC_123';
                if (key === 'SEEPAY_BANK') return 'MB';
                if (key === 'SEEPAY_QR_EXPIRE_MINUTES') return 15;
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionsService,
                { provide: TransactionRepository, useValue: transactionRepository },
                { provide: getRepositoryToken(ClinicAdminInformation), useValue: clinicAdminRepo },
                { provide: getRepositoryToken(TransactionType), useValue: transactionTypeRepo },
                { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
                { provide: getRepositoryToken(ClinicSubscription), useValue: clinicSubscriptionRepo },
                { provide: getRepositoryToken(SubscriptionService), useValue: subscriptionServiceRepo },
                { provide: getRepositoryToken(AppointmentPackage), useValue: packageRepo },
                { provide: SubscriptionServicesService, useValue: subscriptionServicesService },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get<TransactionsService>(TransactionsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ========================================
    // BR 2.1: Prescription Payment (Dynamic QR)
    // ========================================
    describe('BR 2.1: createDynamicQr (Prescription Payment)', () => {
        it('should use sum of pending AppointmentPackage as source of truth for amount', async () => {
            const dto: CreateTransactionDto = {
                prescriptionId: 'uuid-prescription',
                amount: 9999999, // Client sent a different amount
            };

            appointmentRepo.findOne.mockResolvedValue({
                _id: 'uuid-prescription',
                total: 50000,
                clinicId: 'uuid-clinic-account',
            });

            packageRepo.find.mockResolvedValue([
                { _id: 'pkg-1', amount: 20000, status: AppointmentPackageStatus.PENDING_PAYMENT },
                { _id: 'pkg-2', amount: 30000, status: AppointmentPackageStatus.PENDING_PAYMENT },
            ]);

            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                accountId: 'uuid-clinic-account',
                sepayVa: 'CLINIC_VA123',
                bankName: 'TCB',
            });

            const result = await service.createDynamicQr(dto);

            // Should use SUM of packages (20000 + 30000 = 50000)
            expect(result.amount).toBe(50000);
            expect(result.qrCodeUrl).toContain('amount=50000');
        });

        it('should use Clinic account for QR (not Company account)', async () => {
            appointmentRepo.findOne.mockResolvedValue({
                _id: 'uuid-prescription',
                total: 50000,
                clinicId: 'uuid-clinic-account',
            });

            packageRepo.find.mockResolvedValue([
                { _id: 'pkg-1', amount: 50000, status: AppointmentPackageStatus.PENDING_PAYMENT },
            ]);

            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                accountId: 'uuid-clinic-account',
                sepayVa: 'CLINIC_VA123',
                bankName: 'TCB',
            });

            const result = await service.createDynamicQr({ prescriptionId: 'uuid-prescription', amount: 50000 } as any);

            // QR should contain Clinic's account, NOT Company's
            expect(result.qrCodeUrl).toContain('CLINIC_VA123');
            expect(result.qrCodeUrl).not.toContain('COMPANY_ACC_123');
        });

        it('should NOT create Transaction record immediately', async () => {
            appointmentRepo.findOne.mockResolvedValue({
                _id: 'uuid-prescription',
                total: 50000,
                clinicId: 'uuid-clinic-account',
            });

            packageRepo.find.mockResolvedValue([
                { _id: 'pkg-1', amount: 50000, status: AppointmentPackageStatus.PENDING_PAYMENT },
            ]);

            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                sepayVa: 'CLINIC_VA123',
                bankName: 'TCB',
            });

            const result = await service.createDynamicQr({ prescriptionId: 'uuid-prescription', amount: 50000 } as any);

            // Should return id: null
            expect(result.id).toBeNull();
            expect(transactionRepository.save).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if Appointment not found', async () => {
            appointmentRepo.findOne.mockResolvedValue(null);

            await expect(service.createDynamicQr({ prescriptionId: 'invalid', amount: 100 } as any))
                .rejects.toThrow(NotFoundException);
        });
    });

    // ========================================
    // BR 2.2: Clinic Verification QR
    // ========================================
    describe('BR 2.2: createVerificationQr (Clinic Verification)', () => {
        it('should always use fixed amount of 10,000 VND', async () => {
            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                sepayVa: 'CLINIC_VA123',
                bankName: 'MB',
            });

            transactionTypeRepo.findOne.mockResolvedValue({ _id: 'type-verification', name: 'VERIFICATION' });
            (transactionRepository.create as jest.Mock).mockReturnValue({ id: 'new-trans-id', amount: 10000 });
            (transactionRepository.save as jest.Mock).mockResolvedValue({
                id: 'new-trans-id',
                amount: 10000,
                status: PaymentStatus.PENDING,
            });

            const result = await service.createVerificationQr('uuid-clinic-acc');

            expect(result.amount).toBe(10000);
        });

        it('should create Transaction record immediately with PENDING status', async () => {
            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                sepayVa: 'CLINIC_VA123',
                bankName: 'MB',
            });

            transactionTypeRepo.findOne.mockResolvedValue({ _id: 'type-verification', name: 'VERIFICATION' });
            (transactionRepository.create as jest.Mock).mockReturnValue({ id: 'new-trans-id', amount: 10000 });
            (transactionRepository.save as jest.Mock).mockResolvedValue({
                id: 'new-trans-id',
                amount: 10000,
                status: PaymentStatus.PENDING,
            });

            const result = await service.createVerificationQr('uuid-clinic-acc');

            expect(transactionRepository.save).toHaveBeenCalled();
            expect(result.id).toBe('new-trans-id');
            expect(result.status).toBe(PaymentStatus.PENDING);
        });

        it('should use Clinic account for QR (not Company account)', async () => {
            clinicAdminRepo.findOne.mockResolvedValue({
                _id: 'uuid-clinic-admin',
                sepayVa: 'CLINIC_VA123',
                bankName: 'TCB',
            });

            transactionTypeRepo.findOne.mockResolvedValue({ _id: 'type-verification', name: 'VERIFICATION' });
            (transactionRepository.create as jest.Mock).mockReturnValue({ id: 'new-trans-id', amount: 10000 });
            (transactionRepository.save as jest.Mock).mockResolvedValue({
                id: 'new-trans-id',
                amount: 10000,
                status: PaymentStatus.PENDING,
            });

            const result = await service.createVerificationQr('uuid-clinic-acc');

            expect(result.qrCodeUrl).toContain('CLINIC_VA123');
            expect(result.qrCodeUrl).not.toContain('COMPANY_ACC_123');
        });
    });

    // ========================================
    // BR 2.3 & BR 6: Subscription Payment + Company Account Routing
    // ========================================
    describe('BR 2.3 & BR 6: Subscription QR (Company Account Routing)', () => {

        describe('createNewSubscriptionQr', () => {
            it('should create new subscription if none exists', async () => {
                // Mock: No existing subscription
                clinicSubscriptionRepo.findOne.mockResolvedValue(null);
                clinicSubscriptionRepo.create.mockReturnValue({
                    _id: 'new-sub-id',
                    clinicId: 'clinic-1',
                    serviceId: 'service-1',
                    subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
                    expirationDate: new Date('2020-01-01'),
                });
                clinicSubscriptionRepo.save.mockResolvedValue({
                    _id: 'new-sub-id',
                    clinicId: 'clinic-1',
                    serviceId: 'service-1',
                    subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
                    expirationDate: new Date('2020-01-01'),
                });

                // Mock: handlePackageChangeTransaction using spyOn
                const mockTransaction = { id: 'tx-1', amount: 1000000, status: PaymentStatus.PENDING };
                jest.spyOn(service, 'handlePackageChangeTransaction').mockResolvedValue(mockTransaction);
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({
                    id: 'tx-1',
                    amount: 1000000,
                    qrCodeUrl: 'https://qr.seepay.vn/COMPANY_ACC_123/MB/1000000',
                } as any);

                const result = await service.createNewSubscriptionQr('clinic-1', 'service-1');

                expect(clinicSubscriptionRepo.create).toHaveBeenCalled();
                expect(result.qrCodeUrl).toContain('COMPANY_ACC_123');
            });

            it('should throw BadRequest if subscription is ACTIVE and not expired', async () => {
                const futureDate = new Date();
                futureDate.setFullYear(futureDate.getFullYear() + 1);

                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    subscriptionStatus: RegistrationStatus.ACTIVE,
                    expirationDate: futureDate,
                });

                await expect(service.createNewSubscriptionQr('clinic-1', 'service-1'))
                    .rejects.toThrow(BadRequestException);
            });

            it('should use Company account (ENV) for QR generation', async () => {
                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    subscriptionStatus: RegistrationStatus.EXPIRED,
                    expirationDate: new Date('2020-01-01'),
                });

                const mockTransaction = { id: 'tx-1', amount: 500000, status: PaymentStatus.PENDING };
                jest.spyOn(service, 'handlePackageChangeTransaction').mockResolvedValue(mockTransaction);
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({
                    id: 'tx-1',
                    amount: 500000,
                    qrCodeUrl: 'https://qr.seepay.vn/COMPANY_ACC_123/MB/500000',
                } as any);

                const result = await service.createNewSubscriptionQr('clinic-1', 'service-1');

                expect(result.qrCodeUrl).toContain('COMPANY_ACC_123');
            });
        });

        describe('createRenewalQr', () => {
            it('should ALLOW renewal even if subscription is ACTIVE and not expired', async () => {
                const futureDate = new Date();
                futureDate.setFullYear(futureDate.getFullYear() + 1);

                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    serviceId: 'service-1',
                    subscriptionStatus: RegistrationStatus.ACTIVE,
                    expirationDate: futureDate,
                });

                const mockTransaction = { id: 'tx-renew', amount: 500000, status: PaymentStatus.PENDING };
                jest.spyOn(service, 'handleRenewalTransaction').mockResolvedValue(mockTransaction);
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({
                    id: 'tx-renew',
                    amount: 500000,
                    qrCodeUrl: 'https://qr.seepay.vn/COMPANY_ACC_123/MB/500000',
                } as any);

                const result = await service.createRenewalQr('clinic-1');

                expect(result.id).toBe('tx-renew');
                expect(result.qrCodeUrl).toContain('COMPANY_ACC_123');
            });

            it('should allow renewal if subscription is EXPIRED', async () => {
                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    serviceId: 'service-1',
                    subscriptionStatus: RegistrationStatus.EXPIRED,
                    expirationDate: new Date('2020-01-01'),
                });

                const mockTransaction = { id: 'tx-renew', amount: 500000, status: PaymentStatus.PENDING };
                jest.spyOn(service, 'handleRenewalTransaction').mockResolvedValue(mockTransaction);
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({
                    id: 'tx-renew',
                    amount: 500000,
                    qrCodeUrl: 'https://qr.seepay.vn/COMPANY_ACC_123/MB/500000',
                } as any);

                const result = await service.createRenewalQr('clinic-1');

                expect(result.id).toBe('tx-renew');
                expect(result.qrCodeUrl).toContain('COMPANY_ACC_123');
            });

            it('should renew with duration = 12 if current subscription is 12 months', async () => {
                const startDate = new Date('2023-01-01T00:00:00Z');
                const expirationDate = new Date('2024-01-01T00:00:00Z'); // 1 year diff

                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    serviceId: 'service-1',
                    subscriptionStatus: RegistrationStatus.ACTIVE,
                    subscriptionDate: startDate,
                    expirationDate: expirationDate,
                });

                // Mock service price = 100k/month
                subscriptionServiceRepo.findOne.mockResolvedValue({
                    _id: 'service-1',
                    price: 100000,
                    serviceName: 'Pro Plan',
                });

                // Expect amount = 100k * 12 = 1.2M
                const expectedAmount = 100000 * 12;

                const mockTransaction = { id: 'tx-renew', amount: expectedAmount, status: PaymentStatus.PENDING };

                // Spy on createOrUpdateTransaction to check arguments
                jest.spyOn(service, 'createOrUpdateTransaction').mockResolvedValue(mockTransaction);
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({
                    id: 'tx-renew',
                    amount: expectedAmount,
                    qrCodeUrl: 'https://qr.seepay.vn/COMPANY_ACC_123/MB/1200000',
                } as any);

                await service.createRenewalQr('clinic-1');

                // Verify createOrUpdateTransaction was called with duration=12 in content
                expect(service.createOrUpdateTransaction).toHaveBeenCalledWith(
                    expect.anything(),
                    expectedAmount,
                    JSON.stringify({ duration: 12 }),
                    expect.stringContaining('12 months')
                );
            });

            it('should allow renewal if subscription is NON_RENEWING', async () => {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - 1);

                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    serviceId: 'service-1',
                    subscriptionStatus: RegistrationStatus.NON_RENEWING,
                    subscriptionDate: new Date('2023-01-01'),
                    expirationDate: pastDate, // Mock expired
                });

                // Mock service
                subscriptionServiceRepo.findOne.mockResolvedValue({
                    _id: 'service-1',
                    price: 100000,
                    serviceName: 'Pro Plan',
                });

                // Mock Transaction
                jest.spyOn(service, 'createOrUpdateTransaction').mockResolvedValue({ id: 'tx-renew', amount: 100000 });
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({ id: 'tx-renew' } as any);

                const result = await service.createRenewalQr('clinic-1');
                expect(result.id).toBe('tx-renew');
            });
        });

        describe('createPackageChangeQr', () => {
            it('should use Company account for QR generation', async () => {
                clinicSubscriptionRepo.findOne.mockResolvedValue({
                    _id: 'sub-1',
                    clinicId: 'clinic-1',
                    serviceId: 'service-old',
                    subscriptionStatus: RegistrationStatus.ACTIVE,
                    expirationDate: new Date('2099-01-01'),
                });

                const mockTransaction = { id: 'tx-change', amount: 1800000, status: PaymentStatus.PENDING };
                jest.spyOn(service, 'handlePackageChangeTransaction').mockResolvedValue(mockTransaction);
                jest.spyOn(service, 'generateQrResponse').mockResolvedValue({
                    id: 'tx-change',
                    amount: 1800000,
                    qrCodeUrl: 'https://qr.seepay.vn/COMPANY_ACC_123/MB/1800000',
                } as any);

                const result = await service.createPackageChangeQr('clinic-1', 'service-new');

                expect(result.qrCodeUrl).toContain('COMPANY_ACC_123');
            });
        });
    });

    // ========================================
    // BR 3: Callback Processing
    // ========================================
    describe('BR 3: handleCallback (Webhook Processing)', () => {
        const basePayload: SeepayCallbackDto = {
            id: 12345,
            gateway: 'VCB',
            transactionDate: '2023-01-01 10:00:00',
            accountNumber: '9999',
            content: 'Payment for abc',
            transferType: PaymentDirection.IN,
            transferAmount: 50000,
            accumulated: 100000,
            referenceCode: 'REF123',
            prescriptionId: 'uuid-tx-id',
            currency: 'VND',
        } as any;

        describe('Strategy A: Existing Transaction (Verification/Subscription)', () => {
            it('should update existing transaction to SUCCESS', async () => {
                const existingTrans = {
                    id: 'uuid-tx-id',
                    status: PaymentStatus.PENDING,
                    clinicId: 'uuid-clinic',
                    transactionType: { name: 'ONLINE' },
                };

                (transactionRepository.findOne as jest.Mock).mockResolvedValue(existingTrans);
                (transactionRepository.save as jest.Mock).mockResolvedValue({
                    ...existingTrans,
                    status: PaymentStatus.SUCCESS,
                });

                const result = await service.handleCallback(basePayload);

                expect(result.status).toBe(PaymentStatus.SUCCESS);
            });

            it('should set isVerify=true if transaction type is VERIFICATION', async () => {
                const existingTrans = {
                    id: 'uuid-tx-id',
                    status: PaymentStatus.PENDING,
                    clinicId: 'uuid-clinic',
                    transactionType: { name: 'VERIFICATION' },
                };

                (transactionRepository.findOne as jest.Mock).mockResolvedValue(existingTrans);
                (transactionRepository.save as jest.Mock).mockResolvedValue({
                    ...existingTrans,
                    status: PaymentStatus.SUCCESS,
                });

                await service.handleCallback(basePayload);

                expect(clinicAdminRepo.update).toHaveBeenCalledWith(
                    { accountId: 'uuid-clinic' },
                    { isVerify: true }
                );
            });

            it('should call handleSubscriptionPaymentSuccess if transaction type is SUBSCRIPTION', async () => {
                const existingTrans = {
                    id: 'uuid-tx-id',
                    status: PaymentStatus.PENDING,
                    clinicId: 'uuid-clinic',
                    subscriptionId: 'sub-123',
                    content: JSON.stringify({ targetServiceId: 'service-new', duration: 2 }),
                    transactionType: { name: 'SUBSCRIPTION' },
                };

                (transactionRepository.findOne as jest.Mock).mockResolvedValue(existingTrans);
                (transactionRepository.save as jest.Mock).mockResolvedValue({
                    ...existingTrans,
                    status: PaymentStatus.SUCCESS,
                });

                await service.handleCallback(basePayload);

                expect(subscriptionServicesService.handleSubscriptionPaymentSuccess).toHaveBeenCalledWith(
                    'sub-123',
                    'service-new',
                    'uuid-tx-id',
                    2 // duration from content
                );
            });
        });

        describe('Strategy B: New Transaction (Prescription/Appointment)', () => {
            it('should create NEW transaction if no existing transaction found and appointment exists', async () => {
                (transactionRepository.findOne as jest.Mock).mockResolvedValue(null); // No existing tx

                appointmentRepo.findOne.mockResolvedValue({
                    _id: 'uuid-appointment',
                    clinicId: 'uuid-clinic',
                    patient: { _id: 'uuid-patient' },
                });

                transactionTypeRepo.findOne.mockResolvedValue({ _id: 'type-online', name: 'ONLINE' });
                (transactionRepository.create as jest.Mock).mockReturnValue({ id: 'new-tx', amount: 50000 });
                (transactionRepository.save as jest.Mock).mockResolvedValue({
                    id: 'new-tx',
                    status: PaymentStatus.SUCCESS,
                });

                const payload = { ...basePayload, prescriptionId: 'uuid-appointment' };
                const result = await service.handleCallback(payload);

                expect(transactionRepository.create).toHaveBeenCalled();
                expect(packageRepo.update).toHaveBeenCalledWith(
                    { appointmentId: 'uuid-appointment', status: AppointmentPackageStatus.PENDING_PAYMENT },
                    { status: AppointmentPackageStatus.PAID, transactionId: 'new-tx' }
                );
                expect(result.status).toBe(PaymentStatus.SUCCESS);
            });
        });
    });

    // ========================================
    // BR 5: Security & Access Control (Partial)
    // ========================================
    describe('BR 5: Security', () => {
        it('should use DB amount for prescriptions (ignore client input)', async () => {
            // Already covered in BR 2.1 test
        });
    });

    // ========================================
    // Utility: History & Detail
    // ========================================
    describe('Utility Methods', () => {
        describe('getAllPaymentHistory', () => {
            it('should return paginated items', async () => {
                const mockItems = [{ _id: '1', amount: 100, clinic_name: 'Clinic A' }];
                (transactionRepository.findAllPaymentHistory as jest.Mock).mockResolvedValue(mockItems);
                (transactionRepository.countPaymentHistory as jest.Mock).mockResolvedValue(1);

                const result = await service.getAllPaymentHistory(1, 10);

                expect(result.items.length).toBe(1);
                expect(result.total).toBe(1);
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
            });

            it('should throw NotFoundException if not found', async () => {
                (transactionRepository.findDetailById as jest.Mock).mockResolvedValue(null);
                await expect(service.getTransactionDetail('invalid')).rejects.toThrow(NotFoundException);
            });
        });
    });
});

