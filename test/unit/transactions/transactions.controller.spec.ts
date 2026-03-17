import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from '../../../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../../../src/modules/transactions/transactions.service';
import { CreateTransactionDto } from '../../../src/modules/transactions/dto/create-transaction.dto';
import { SeepayCallbackDto } from '../../../src/modules/transactions/dto/seepay-callback.dto';
import { Account } from '../../../src/modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../../src/modules/accounts/enums';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClinicAdminInformation } from '../../../src/modules/accounts/entities/clinic-admin-information.entity';

describe('TransactionsController', () => {
    let controller: TransactionsController;
    let service: any;
    let configService: any;
    let clinicAdminRepo: any;

    beforeEach(async () => {
        service = {
            createDynamicQr: jest.fn(),
            createVerificationQr: jest.fn(),
            handleCallback: jest.fn(),
            getAllPaymentHistory: jest.fn(),
            getTransactionDetail: jest.fn(),
            getClinicAdminIdByAccountId: jest.fn(),
        };

        configService = {
            get: jest.fn(),
        };

        clinicAdminRepo = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TransactionsController],
            providers: [
                {
                    provide: TransactionsService,
                    useValue: service,
                },
                {
                    provide: ConfigService,
                    useValue: configService,
                },
                {
                    provide: getRepositoryToken(ClinicAdminInformation),
                    useValue: clinicAdminRepo,
                },
            ],
        }).compile();

        controller = module.get<TransactionsController>(TransactionsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createQr', () => {
        it('should call service.createDynamicQr', async () => {
            const dto: Omit<CreateTransactionDto, 'appointmentId'> = { amount: 50000 };
            const appointmentId = 'uuid';
            service.createDynamicQr.mockResolvedValue({ id: 'res' });

            const result = await controller.createQr(appointmentId, dto);
            expect(service.createDynamicQr).toHaveBeenCalledWith({ ...dto, appointmentId });
            expect(result.data).toBeDefined();
        });
    });

    describe('createVerificationQr', () => {
        it('should call service.createVerificationQr', async () => {
            const user = { _id: 'user-id' } as Account;
            service.createVerificationQr.mockResolvedValue({ id: 'res' });
            const result = await controller.createVerificationQr(user);
            expect(service.createVerificationQr).toHaveBeenCalledWith(user._id);
            expect(result.message).toContain('success');
        });
    });

    describe('handleCallback', () => {
        it('should call service.handleCallback', async () => {
            const payload = new SeepayCallbackDto();
            service.handleCallback.mockResolvedValue({ orderCode: '123' });
            const result = await controller.handleCallback(payload);
            expect(service.handleCallback).toHaveBeenCalledWith(payload);
            expect(result.data.orderCode).toBe('123');
        });
    });

    describe('getAllPaymentHistory', () => {
        it('should call service.getAllPaymentHistory with correct filters for Admin', async () => {
            const user = { _id: 'admin-id', role: AccountRole.CLINIC_ADMIN } as Account;
            service.getAllPaymentHistory.mockResolvedValue({ items: [], total: 0 });

            await controller.getAllPaymentHistory(user, 1, 10);

            expect(service.getAllPaymentHistory).toHaveBeenCalledWith(
                1, 10, expect.objectContaining({ clinicId: 'admin-id' })
            );
        });
    });

    describe('getTransactionDetail', () => {
        it('should call service.getTransactionDetail', async () => {
            const user = { _id: 'admin-id', role: AccountRole.CLINIC_ADMIN } as Account;
            service.getTransactionDetail.mockResolvedValue({ id: 'trans-1' });

            const result = await controller.getTransactionDetail('trans-1', user);
            expect(service.getTransactionDetail).toHaveBeenCalledWith('trans-1', 'admin-id');
            expect(result.data.id).toBe('trans-1');
        });
    });
});
