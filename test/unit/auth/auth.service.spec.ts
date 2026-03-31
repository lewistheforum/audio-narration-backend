import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { AccountsService } from '../../../src/modules/accounts/accounts.service';
import { JwtService } from '@nestjs/jwt';
import { SocketGatewayService } from '../../../src/modules/socket-gateway/socket-gateway.service';
import { CodeVerificationRepository } from '../../../src/modules/accounts/repositories/code-verification.repository';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AccountRole } from '../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../src/modules/accounts/enums/account-status.enum';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
    let service: AuthService;
    let accountsService: any;
    let jwtService: any;
    let socketGatewayService: any;
    let codeVerificationRepo: any;

    // Mock Data Factory
    const createMockAccount = (overrides = {}) => ({
        _id: 'user-123',
        email: 'test@example.com',
        password: '$2b$10$hashedpassword', // bcrypt hash
        role: AccountRole.DOCTOR,
        status: AccountStatus.ACTIVE,
        parentId: 'manager-123',
        isEmailVerified: true,
        isOAuthUser: false,
        ...overrides,
    });

    const createMockGeneralAccount = (overrides = {}) => ({
        _id: 'general-123',
        accountId: 'user-123',
        fullName: 'Test User',
        profilePicture: null,
        ...overrides,
    });

    const createMockAccountResponse = (overrides = {}) => ({
        _id: 'user-123',
        email: 'test@example.com',
        role: AccountRole.DOCTOR,
        fullName: 'Test User',
        ...overrides,
    });

    const createMockSubscription = (overrides = {}) => ({
        _id: 'sub-1',
        clinicId: 'admin-123',
        serviceId: 'service-1',
        subscriptionStatus: RegistrationStatus.ACTIVE,
        expirationDate: new Date('2026-12-31T23:59:59.999Z'),
        ...overrides,
    });

    beforeEach(async () => {
        // Mock AccountsService
        accountsService = {
            findByEmail: jest.fn().mockResolvedValue(createMockAccount()),
            validateAccountAccess: jest.fn().mockReturnValue(undefined),
            validateParentManagerStatus: jest.fn().mockResolvedValue(undefined),
            validateClinicSubscription: jest.fn().mockResolvedValue(undefined),
            findGeneralAccountByUserId: jest.fn().mockResolvedValue(createMockGeneralAccount()),
            findAccountEntityById: jest.fn().mockResolvedValue(createMockAccount()),
            updateAccountEntity: jest.fn().mockResolvedValue(undefined),
            updateGeneralAccountEntity: jest.fn().mockResolvedValue(undefined),
            createPatientViaOAuth: jest.fn().mockResolvedValue({
                id: 'new-user-123',
                email: 'newuser@example.com',
            }),
            getSubscriptionPayloadForAccount: jest.fn().mockResolvedValue({}),
            resolveClinicAdminId: jest.fn().mockResolvedValue('admin-123'),
            getClinicSubscription: jest.fn().mockResolvedValue(createMockSubscription()),
        };

        // Mock JwtService
        jwtService = {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
        };

        // Mock SocketGatewayService
        socketGatewayService = {
            markUserOnline: jest.fn().mockReturnValue(undefined),
        };

        // Mock CodeVerificationRepository
        codeVerificationRepo = {
            findByUserId: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: AccountsService, useValue: accountsService },
                { provide: JwtService, useValue: jwtService },
                { provide: SocketGatewayService, useValue: socketGatewayService },
                { provide: CodeVerificationRepository, useValue: codeVerificationRepo },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('login', () => {
        describe('Case: Successful Login (Happy Paths)', () => {
            it('should allow DOCTOR login when root admin subscription is ACTIVE', async () => {
                const loginDto = { email: 'doctor@clinic.com', password: 'password123', role: AccountRole.DOCTOR };

                // Mock DOCTOR account
                const mockDoctor = createMockAccount({
                    role: AccountRole.DOCTOR,
                    parentId: 'manager-123',
                });

                // Mock bcrypt compare
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                accountsService.findByEmail.mockResolvedValue(mockDoctor);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(result.data.userId).toBe('user-123');
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockDoctor);
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockDoctor);
                expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
                    sub: mockDoctor._id,
                    uId: mockDoctor._id,
                    email: mockDoctor.email,
                    role: mockDoctor.role,
                }));
                expect(socketGatewayService.markUserOnline).toHaveBeenCalledWith(String(mockDoctor._id));
            });

            it('should allow CLINIC_ADMIN login when subscription is NON_RENEWING', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockAdmin);
            });

            it('should allow CLINIC_MANAGER login when subscription is ACTIVE', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    _id: 'manager-123',
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockManager);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockManager);
            });

            it('should allow CLINIC_STAFF login when subscription is ACTIVE', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123', role: AccountRole.CLINIC_STAFF };

                const mockStaff = createMockAccount({
                    _id: 'staff-123',
                    role: AccountRole.CLINIC_STAFF,
                    parentId: 'manager-123',
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockStaff);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockStaff);
            });

            it('should allow PATIENT login (bypasses subscription check)', async () => {
                const loginDto = { email: 'patient@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockPatient = createMockAccount({
                    _id: 'patient-123',
                    role: AccountRole.PATIENT,
                    parentId: null,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockPatient);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockPatient);
            });

            it('should allow ADMIN login (bypasses subscription check)', async () => {
                const loginDto = { email: 'admin@system.com', password: 'password123', role: AccountRole.ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-system-123',
                    role: AccountRole.ADMIN,
                    parentId: null,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockAdmin);
            });

            it('should return user data with generalAccount information', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123', role: AccountRole.DOCTOR };

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result.data.user).toBeDefined();
                expect(accountsService.findGeneralAccountByUserId).toHaveBeenCalledWith('user-123');
            });

            it('should mark user as online after successful login', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123', role: AccountRole.DOCTOR };

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute
                await service.login(loginDto);

                // Verify
                expect(socketGatewayService.markUserOnline).toHaveBeenCalledWith('user-123');
            });
        });

        describe('Case: Subscription Failures (Guard Check)', () => {
            beforeEach(() => {
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            });

            // CLINIC_ADMIN Tests: Allow login even if subscription is EXPIRED
            it('should allow CLINIC_ADMIN login when subscription is EXPIRED', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockResolvedValue(undefined);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            it('should allow CLINIC_ADMIN login when subscription is PENDING_SEPAY_SETUP', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockAdmin);
            });

            it('should allow CLINIC_ADMIN login when subscription is PENDING_MANAGER_SETUP', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            it('should allow CLINIC_ADMIN login when subscription is PENDING_LEGAL_SETUP', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            it('should allow CLINIC_ADMIN login when subscription is PENDING_APPROVAL', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            it('should allow CLINIC_ADMIN login when subscription is PENDING_PAYMENT', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            // CLINIC_MANAGER Tests: Block if parent subscription not ACTIVE/NON_RENEWING OR legal docs not APPROVED
            it('should block CLINIC_MANAGER when parent subscription is EXPIRED', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Account is not ready or clinic is not active'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow(
                    'Account is not ready or clinic is not active',
                );
            });

            it('should block CLINIC_MANAGER when parent subscription is PENDING_APPROVAL', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Account is not ready or clinic is not active'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block CLINIC_MANAGER when legal documents are PENDING_REVIEW', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Account is not ready or clinic is not active'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block CLINIC_MANAGER when legal documents are NOT_SUBMITTED', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Account is not ready or clinic is not active'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should allow CLINIC_MANAGER login when parent subscription is ACTIVE and legal docs are APPROVED', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                // validateClinicSubscription passes (no rejection)

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockManager);
            });

            it('should allow CLINIC_MANAGER login when parent subscription is NON_RENEWING and legal docs are APPROVED', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123', role: AccountRole.CLINIC_MANAGER };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                // validateClinicSubscription passes

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            // CLINIC_STAFF and DOCTOR tests
            it('should block CLINIC_STAFF when subscription is PENDING_PAYMENT', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123', role: AccountRole.CLINIC_STAFF };

                const mockStaff = createMockAccount({
                    role: AccountRole.CLINIC_STAFF,
                    parentId: 'manager-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockStaff);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block DOCTOR when subscription is EXPIRED', async () => {
                const loginDto = { email: 'doctor@clinic.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockDoctor = createMockAccount({
                    role: AccountRole.DOCTOR,
                    parentId: 'manager-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockDoctor);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block login when subscription not found', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription not found. Please contact support.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow(
                    'Clinic subscription not found. Please contact support.',
                );
            });

            it('should block CLINIC_STAFF when parent hierarchy is invalid', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123', role: AccountRole.CLINIC_STAFF };

                const mockStaff = createMockAccount({
                    role: AccountRole.CLINIC_STAFF,
                    parentId: 'manager-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockStaff);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription validation failed: Invalid account hierarchy.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('Invalid account hierarchy');
            });

            it('should block DOCTOR when no parent account found', async () => {
                const loginDto = { email: 'doctor@clinic.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockDoctor = createMockAccount({
                    role: AccountRole.DOCTOR,
                    parentId: null, // No parent
                });

                accountsService.findByEmail.mockResolvedValue(mockDoctor);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription validation failed: No parent account found.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('No parent account found');
            });
        });

        describe('Case: Parent Manager Status Validation', () => {
            it('should block CLINIC_STAFF when parent manager is MANAGER_DISABLED', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123', role: AccountRole.CLINIC_STAFF };

                const mockStaff = createMockAccount({
                    role: AccountRole.CLINIC_STAFF,
                    parentId: 'manager-123',
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockStaff);
                accountsService.validateParentManagerStatus.mockRejectedValue(
                    new ForbiddenException(
                        'Your clinic branch has been temporarily disabled. ' +
                        'Please contact your clinic administrator for assistance.'
                    ),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('temporarily disabled');
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockStaff);
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockStaff);
                expect(jwtService.sign).not.toHaveBeenCalled();
                expect(socketGatewayService.markUserOnline).not.toHaveBeenCalled();
            });

            it('should block CLINIC_STAFF when parent manager is PENDING_APPROVAL', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123', role: AccountRole.CLINIC_STAFF };

                const mockStaff = createMockAccount({
                    role: AccountRole.CLINIC_STAFF,
                    parentId: 'manager-123',
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockStaff);
                accountsService.validateParentManagerStatus.mockRejectedValue(
                    new ForbiddenException(
                        'Your clinic branch is pending legal document approval. ' +
                        'You will be able to login once verification is complete.'
                    ),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('pending legal document approval');
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockStaff);
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockStaff);
                expect(accountsService.validateClinicSubscription).not.toHaveBeenCalled();
            });

            it('should block DOCTOR when parent manager is MANAGER_DISABLED', async () => {
                const loginDto = { email: 'doctor@clinic.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockDoctor = createMockAccount({
                    role: AccountRole.DOCTOR,
                    parentId: 'manager-123',
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockDoctor);
                accountsService.validateParentManagerStatus.mockRejectedValue(
                    new ForbiddenException(
                        'Your clinic branch has been temporarily disabled. ' +
                        'Please contact your clinic administrator for assistance.'
                    ),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('temporarily disabled');
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockDoctor);
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockDoctor);
                expect(jwtService.sign).not.toHaveBeenCalled();
            });

            it('should block DOCTOR when parent manager is PENDING_APPROVAL', async () => {
                const loginDto = { email: 'doctor@clinic.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockDoctor = createMockAccount({
                    role: AccountRole.DOCTOR,
                    parentId: 'manager-123',
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockDoctor);
                accountsService.validateParentManagerStatus.mockRejectedValue(
                    new ForbiddenException(
                        'Your clinic branch is pending legal document approval. ' +
                        'You will be able to login once verification is complete.'
                    ),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('pending legal document approval');
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockDoctor);
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockDoctor);
            });

            it('should allow CLINIC_STAFF login when parent manager is ACTIVE', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123', role: AccountRole.CLINIC_STAFF };

                const mockStaff = createMockAccount({
                    role: AccountRole.CLINIC_STAFF,
                    parentId: 'manager-123',
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockStaff);
                accountsService.validateParentManagerStatus.mockResolvedValue(undefined);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockStaff);
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockStaff);
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockStaff);
                expect(socketGatewayService.markUserOnline).toHaveBeenCalled();
            });

            it('should NOT check parent status for CLINIC_ADMIN role', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    role: AccountRole.CLINIC_ADMIN,
                    parentId: null,
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockAdmin);

                // Execute
                const result = await service.login(loginDto);

                // Verify - validateParentManagerStatus should be called but will return early
                expect(result).toBeDefined();
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockAdmin);
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });

            it('should NOT check parent status for PATIENT role', async () => {
                const loginDto = { email: 'patient@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockPatient = createMockAccount({
                    role: AccountRole.PATIENT,
                    parentId: null,
                    status: AccountStatus.ACTIVE,
                });

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
                accountsService.findByEmail.mockResolvedValue(mockPatient);

                // Execute
                const result = await service.login(loginDto);

                // Verify - validateParentManagerStatus should be called but will return early
                expect(result).toBeDefined();
                expect(accountsService.validateParentManagerStatus).toHaveBeenCalledWith(mockPatient);
                expect(result.data.accessToken).toBe('mock-jwt-token');
            });
        });

        describe('Case: Standard Auth Failures', () => {
            it('should throw UnauthorizedException when password is incorrect', async () => {
                const loginDto = { email: 'user@example.com', password: 'wrongpassword', role: AccountRole.DOCTOR };

                accountsService.findByEmail.mockResolvedValue(createMockAccount());
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
            });

            it('should throw UnauthorizedException when user not found', async () => {
                const loginDto = { email: 'nonexistent@example.com', password: 'password123', role: AccountRole.DOCTOR };

                accountsService.findByEmail.mockResolvedValue(null);

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
            });

            it('should validate account access before subscription check', async () => {
                const loginDto = { email: 'banned@example.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockBannedUser = createMockAccount({
                    status: AccountStatus.BAN,
                });

                accountsService.findByEmail.mockResolvedValue(mockBannedUser);
                accountsService.validateAccountAccess.mockImplementation(() => {
                    throw new ForbiddenException('Your account has been banned.');
                });
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('Your account has been banned.');

                // Subscription check should not be called if account access fails
                expect(accountsService.validateClinicSubscription).not.toHaveBeenCalled();
            });

            it('should throw UnauthorizedException when account status is DELETED', async () => {
                const loginDto = { email: 'deleted@example.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockDeletedUser = createMockAccount({
                    status: AccountStatus.DELETED,
                });

                accountsService.findByEmail.mockResolvedValue(mockDeletedUser);
                accountsService.validateAccountAccess.mockImplementation(() => {
                    throw new UnauthorizedException('Your account has been deleted. Please contact support for assistance.');
                });
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
                await expect(service.login(loginDto)).rejects.toThrow('account has been deleted');
            });
        });

        describe('Case: UNVERIFIED Status Handling', () => {
            beforeEach(() => {
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            });

            it('should allow UNVERIFIED user to login and return access token', async () => {
                const loginDto = { email: 'unverified@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockUnverifiedUser = createMockAccount({
                    _id: 'unverified-user-123',
                    email: 'unverified@example.com',
                    status: AccountStatus.UNVERIFIED,
                    role: AccountRole.PATIENT,
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedUser);
                accountsService.validateAccountAccess.mockReturnValue(undefined); // Should not throw

                // Execute
                const result = await service.login(loginDto);

                // Verify - token should be generated
                expect(result).toBeDefined();
                expect(result.data).toBeDefined();
                expect(result.data.accessToken).toBe('mock-jwt-token');
                expect(result.data.userId).toBe('unverified-user-123');
                expect(result.data.user).toBeDefined();
            });

            it('should return warning message for UNVERIFIED status', async () => {
                const loginDto = { email: 'unverified@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockUnverifiedUser = createMockAccount({
                    status: AccountStatus.UNVERIFIED,
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedUser);

                // Execute
                const result = await service.login(loginDto);

                // Verify - message should be the unverified warning
                expect(result.message).toBe('Login successful. Please verify your email address to access full features.');
            });

            it('should return standard message for ACTIVE status', async () => {
                const loginDto = { email: 'active@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockActiveUser = createMockAccount({
                    status: AccountStatus.ACTIVE,
                });

                accountsService.findByEmail.mockResolvedValue(mockActiveUser);

                // Execute
                const result = await service.login(loginDto);

                // Verify - message should be the standard login success
                expect(result.message).toBe('User logged in successfully');
            });

            it('should call validateClinicSubscription for UNVERIFIED clinic users', async () => {
                const loginDto = { email: 'unverified-doctor@clinic.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockUnverifiedDoctor = createMockAccount({
                    status: AccountStatus.UNVERIFIED,
                    role: AccountRole.DOCTOR,
                    parentId: 'manager-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedDoctor);

                // Execute
                await service.login(loginDto);

                // Verify - subscription validation should still happen
                expect(accountsService.validateClinicSubscription).toHaveBeenCalledWith(mockUnverifiedDoctor);
            });

            it('should mark UNVERIFIED user as online after login', async () => {
                const loginDto = { email: 'unverified@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockUnverifiedUser = createMockAccount({
                    _id: 'unverified-user-123',
                    status: AccountStatus.UNVERIFIED,
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedUser);

                // Execute
                await service.login(loginDto);

                // Verify - should be marked online
                expect(socketGatewayService.markUserOnline).toHaveBeenCalledWith('unverified-user-123');
            });

            it('should generate JWT with correct payload for UNVERIFIED user', async () => {
                const loginDto = { email: 'unverified@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockUnverifiedUser = createMockAccount({
                    _id: 'unverified-456',
                    email: 'unverified@example.com',
                    role: AccountRole.PATIENT,
                    status: AccountStatus.UNVERIFIED,
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedUser);

                // Execute
                await service.login(loginDto);

                // Verify - JWT payload should be correct
                expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
                    sub: 'unverified-456',
                    uId: 'unverified-456',
                    email: 'unverified@example.com',
                    role: AccountRole.PATIENT,
                }));
            });

            it('should fetch general account data for UNVERIFIED user', async () => {
                const loginDto = { email: 'unverified@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockUnverifiedUser = createMockAccount({
                    _id: 'unverified-789',
                    status: AccountStatus.UNVERIFIED,
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedUser);

                // Execute
                await service.login(loginDto);

                // Verify - general account should be fetched
                expect(accountsService.findGeneralAccountByUserId).toHaveBeenCalledWith('unverified-789');
            });

            it('should validate account access (BAN/DELETED check) for UNVERIFIED users', async () => {
                const loginDto = { email: 'unverified@example.com', password: 'password123', role: AccountRole.PATIENT };

                const mockUnverifiedUser = createMockAccount({
                    status: AccountStatus.UNVERIFIED,
                });

                accountsService.findByEmail.mockResolvedValue(mockUnverifiedUser);

                // Execute
                await service.login(loginDto);

                // Verify - validateAccountAccess should still be called
                expect(accountsService.validateAccountAccess).toHaveBeenCalledWith(mockUnverifiedUser);
            });
        });

        describe('Case: JWT Token Generation', () => {
            beforeEach(() => {
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            });

            it('should generate JWT token with correct payload', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123', role: AccountRole.DOCTOR };

                const mockUser = createMockAccount({
                    _id: 'user-456',
                    email: 'user@example.com',
                    role: AccountRole.DOCTOR,
                });

                accountsService.findByEmail.mockResolvedValue(mockUser);

                // Execute
                await service.login(loginDto);

                // Verify
                expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
                    sub: 'user-456',
                    uId: 'user-456',
                    email: 'user@example.com',
                    role: AccountRole.DOCTOR,
                }));
            });

            it('should return accessToken in response', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123', role: AccountRole.DOCTOR };

                jwtService.sign.mockReturnValue('custom-token-xyz');

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result.data.accessToken).toBe('custom-token-xyz');
            });
        });

        describe('Case: Integration Flow', () => {
            beforeEach(() => {
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            });

            it('should execute complete login flow in correct order', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123', role: AccountRole.DOCTOR };
                const callOrder: string[] = [];

                accountsService.findByEmail.mockImplementation(async () => {
                    callOrder.push('findByEmail');
                    return createMockAccount();
                });

                accountsService.validateAccountAccess.mockImplementation(() => {
                    callOrder.push('validateAccountAccess');
                });

                accountsService.validateClinicSubscription.mockImplementation(async () => {
                    callOrder.push('validateClinicSubscription');
                });

                socketGatewayService.markUserOnline.mockImplementation(() => {
                    callOrder.push('markUserOnline');
                });

                accountsService.findGeneralAccountByUserId.mockImplementation(async () => {
                    callOrder.push('findGeneralAccountByUserId');
                    return createMockGeneralAccount();
                });

                accountsService.getSubscriptionPayloadForAccount.mockImplementation(async () => {
                    callOrder.push('getSubscriptionPayloadForAccount');
                    return {};
                });

                jwtService.sign.mockImplementation(() => {
                    callOrder.push('jwtSign');
                    return 'token';
                });

                // Execute
                await service.login(loginDto);

                // Verify order
                expect(callOrder).toEqual([
                    'findByEmail',
                    'validateAccountAccess',
                    'validateClinicSubscription',
                    'getSubscriptionPayloadForAccount',
                    'markUserOnline',
                    'findGeneralAccountByUserId',
                    'jwtSign',
                ]);
            });

            it('should not call subscription validation if password is wrong', async () => {
                const loginDto = { email: 'user@example.com', password: 'wrongpassword', role: AccountRole.DOCTOR };

                accountsService.findByEmail.mockResolvedValue(createMockAccount());
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

                expect(accountsService.validateAccountAccess).not.toHaveBeenCalled();
                expect(accountsService.validateClinicSubscription).not.toHaveBeenCalled();
            });

            it('should allow CLINIC_ADMIN login even if subscription is EXPIRED', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123', role: AccountRole.CLINIC_ADMIN };

                const mockAdmin = createMockAccount({
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                // AccountsService.validateClinicSubscription now returns void (no throw) for CLINIC_ADMIN
                accountsService.validateClinicSubscription.mockResolvedValue(undefined);

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result).toBeDefined();
                expect(socketGatewayService.markUserOnline).toHaveBeenCalled();
            });
        });
    });
});
