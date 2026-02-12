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
            validateClinicSubscription: jest.fn().mockResolvedValue(undefined),
            findGeneralAccountByUserId: jest.fn().mockResolvedValue(createMockGeneralAccount()),
            findAccountEntityById: jest.fn().mockResolvedValue(createMockAccount()),
            updateAccountEntity: jest.fn().mockResolvedValue(undefined),
            updateGeneralAccountEntity: jest.fn().mockResolvedValue(undefined),
            createPatientViaOAuth: jest.fn().mockResolvedValue({
                id: 'new-user-123',
                email: 'newuser@example.com',
            }),
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
                const loginDto = { email: 'doctor@clinic.com', password: 'password123' };

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
                expect(jwtService.sign).toHaveBeenCalledWith({
                    sub: mockDoctor._id,
                    email: mockDoctor.email,
                    role: mockDoctor.role,
                });
                expect(socketGatewayService.markUserOnline).toHaveBeenCalledWith(String(mockDoctor._id));
            });

            it('should allow CLINIC_ADMIN login when subscription is NON_RENEWING', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

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
                const loginDto = { email: 'manager@clinic.com', password: 'password123' };

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
                const loginDto = { email: 'staff@clinic.com', password: 'password123' };

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
                const loginDto = { email: 'patient@example.com', password: 'password123' };

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
                const loginDto = { email: 'admin@system.com', password: 'password123' };

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
                const loginDto = { email: 'user@example.com', password: 'password123' };

                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute
                const result = await service.login(loginDto);

                // Verify
                expect(result.data.user).toBeDefined();
                expect(accountsService.findGeneralAccountByUserId).toHaveBeenCalledWith('user-123');
            });

            it('should mark user as online after successful login', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123' };

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

            it('should block CLINIC_MANAGER when subscription is EXPIRED', async () => {
                const loginDto = { email: 'manager@clinic.com', password: 'password123' };

                const mockManager = createMockAccount({
                    role: AccountRole.CLINIC_MANAGER,
                    parentId: 'admin-123',
                });

                accountsService.findByEmail.mockResolvedValue(mockManager);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow(
                    'Clinic subscription is not active or has expired.',
                );
            });

            it('should block CLINIC_STAFF when subscription is PENDING_PAYMENT', async () => {
                const loginDto = { email: 'staff@clinic.com', password: 'password123' };

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

            it('should block DOCTOR when subscription is REJECTED', async () => {
                const loginDto = { email: 'doctor@clinic.com', password: 'password123' };

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
                await expect(service.login(loginDto)).rejects.toThrow(
                    'Clinic subscription is not active or has expired.',
                );
            });

            it('should block CLINIC_ADMIN when subscription is PENDING_SEPAY_SETUP', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block CLINIC_ADMIN when subscription is PENDING_MANAGER_SETUP', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block CLINIC_ADMIN when subscription is PENDING_LEGAL_SETUP', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block CLINIC_ADMIN when subscription is PENDING_APPROVAL', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

                const mockAdmin = createMockAccount({
                    _id: 'admin-123',
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
            });

            it('should block login when subscription not found', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

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
                const loginDto = { email: 'staff@clinic.com', password: 'password123' };

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
                const loginDto = { email: 'doctor@clinic.com', password: 'password123' };

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

        describe('Case: Standard Auth Failures', () => {
            it('should throw UnauthorizedException when password is incorrect', async () => {
                const loginDto = { email: 'user@example.com', password: 'wrongpassword' };

                accountsService.findByEmail.mockResolvedValue(createMockAccount());
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
            });

            it('should throw UnauthorizedException when user not found', async () => {
                const loginDto = { email: 'nonexistent@example.com', password: 'password123' };

                accountsService.findByEmail.mockResolvedValue(null);

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
            });

            it('should validate account access before subscription check', async () => {
                const loginDto = { email: 'banned@example.com', password: 'password123' };

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

            it('should throw UnauthorizedException when account is PENDING verification', async () => {
                const loginDto = { email: 'pending@example.com', password: 'password123' };

                const mockPendingUser = createMockAccount({
                    status: AccountStatus.PENDING,
                });

                accountsService.findByEmail.mockResolvedValue(mockPendingUser);
                accountsService.validateAccountAccess.mockImplementation(() => {
                    throw new UnauthorizedException('Email verification required. Please verify your email to activate your account.');
                });
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
                await expect(service.login(loginDto)).rejects.toThrow('Email verification required');
            });

            it('should throw ForbiddenException when account status is EXPIRED', async () => {
                const loginDto = { email: 'expired@example.com', password: 'password123' };

                const mockExpiredUser = createMockAccount({
                    status: AccountStatus.EXPIRED,
                });

                accountsService.findByEmail.mockResolvedValue(mockExpiredUser);
                accountsService.validateAccountAccess.mockImplementation(() => {
                    throw new ForbiddenException('Your subscription has expired. Please renew your subscription to continue.');
                });
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('subscription has expired');
            });

            it('should throw ForbiddenException when account status is REFILL', async () => {
                const loginDto = { email: 'refill@example.com', password: 'password123' };

                const mockRefillUser = createMockAccount({
                    status: AccountStatus.REFILL,
                });

                accountsService.findByEmail.mockResolvedValue(mockRefillUser);
                accountsService.validateAccountAccess.mockImplementation(() => {
                    throw new ForbiddenException('Your account needs a refill. Please refill your subscription to continue.');
                });
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
                await expect(service.login(loginDto)).rejects.toThrow('needs a refill');
            });

            it('should throw UnauthorizedException when account status is INACTIVE', async () => {
                const loginDto = { email: 'inactive@example.com', password: 'password123' };

                const mockInactiveUser = createMockAccount({
                    status: AccountStatus.INACTIVE,
                });

                accountsService.findByEmail.mockResolvedValue(mockInactiveUser);
                accountsService.validateAccountAccess.mockImplementation(() => {
                    throw new UnauthorizedException('Your account is inactive. Please contact support for assistance.');
                });
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
                await expect(service.login(loginDto)).rejects.toThrow('account is inactive');
            });

            it('should throw UnauthorizedException when account status is DELETED', async () => {
                const loginDto = { email: 'deleted@example.com', password: 'password123' };

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

        describe('Case: JWT Token Generation', () => {
            beforeEach(() => {
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            });

            it('should generate JWT token with correct payload', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123' };

                const mockUser = createMockAccount({
                    _id: 'user-456',
                    email: 'user@example.com',
                    role: AccountRole.DOCTOR,
                });

                accountsService.findByEmail.mockResolvedValue(mockUser);

                // Execute
                await service.login(loginDto);

                // Verify
                expect(jwtService.sign).toHaveBeenCalledWith({
                    sub: 'user-456',
                    email: 'user@example.com',
                    role: AccountRole.DOCTOR,
                });
            });

            it('should return accessToken in response', async () => {
                const loginDto = { email: 'user@example.com', password: 'password123' };

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
                const loginDto = { email: 'user@example.com', password: 'password123' };
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
                    'jwtSign',
                    'markUserOnline',
                    'findGeneralAccountByUserId',
                ]);
            });

            it('should not call subscription validation if password is wrong', async () => {
                const loginDto = { email: 'user@example.com', password: 'wrongpassword' };

                accountsService.findByEmail.mockResolvedValue(createMockAccount());
                jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

                expect(accountsService.validateAccountAccess).not.toHaveBeenCalled();
                expect(accountsService.validateClinicSubscription).not.toHaveBeenCalled();
            });

            it('should not mark user online if subscription validation fails', async () => {
                const loginDto = { email: 'admin@clinic.com', password: 'password123' };

                const mockAdmin = createMockAccount({
                    role: AccountRole.CLINIC_ADMIN,
                });

                accountsService.findByEmail.mockResolvedValue(mockAdmin);
                accountsService.validateClinicSubscription.mockRejectedValue(
                    new ForbiddenException('Clinic subscription is not active or has expired.'),
                );

                // Execute & Verify
                await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);

                expect(socketGatewayService.markUserOnline).not.toHaveBeenCalled();
                expect(jwtService.sign).not.toHaveBeenCalled();
            });
        });
    });
});
