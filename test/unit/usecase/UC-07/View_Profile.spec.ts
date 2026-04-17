import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { RolesGuard } from '../../../../src/common/guards/roles.guard';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { ClinicRole } from '../../../../src/modules/accounts/enums/clinic-role.enum';
import { AccountRepository } from '../../../../src/modules/accounts/repositories/account.repository';
import { AddressRepository } from '../../../../src/modules/accounts/repositories/address.repository';
import { ClinicAdminInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-admin-information.repository';
import { ClinicManagerInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-manager-information.repository';
import { ClinicStaffInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-staff-information.repository';
import { ClinicsLegalDocumentsRepository } from '../../../../src/modules/accounts/repositories/clinics-legal-documents.repository';
import { CodeVerificationRepository } from '../../../../src/modules/accounts/repositories/code-verification.repository';
import { DoctorInformationRepository } from '../../../../src/modules/accounts/repositories/doctor-information.repository';
import { GeneralAccountRepository } from '../../../../src/modules/accounts/repositories/general-account.repository';
import { GoogleIframeRepository } from '../../../../src/modules/accounts/repositories/google-iframe.repository';
import { ZaloWebhookService } from '../../../../src/modules/accounts/zalo-webhook.service';
import { JwtAuthGuard } from '../../../../src/modules/auth/jwt.strategy';
import { ContractPackageRepository } from '../../../../src/modules/contracts/repositories/contract-package.repository';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { TransactionRepository } from '../../../../src/modules/transactions/repositories/transaction.repository';
import { DataSource } from 'typeorm';

describe('UC-07 View Profile', () => {
  let controller: AccountsController;
  let service: AccountsService;
  let accountRepository: { findAccountById: jest.Mock };
  let addressRepository: { findByAccountId: jest.Mock };
  let googleIframeRepository: { findByAddressId: jest.Mock };
  let generalAccountRepository: { findByAccountId: jest.Mock };
  let clinicAdminInfoRepository: { findByAccountId: jest.Mock };
  let clinicManagerInfoRepository: { findByAccountId: jest.Mock };
  let clinicStaffRepository: { findByAccountId: jest.Mock };
  let doctorInfoRepository: { findByAccountId: jest.Mock };

  const validId = '11111111-1111-4111-8111-111111111111';
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');

  const createAccount = (role: AccountRole | string, overrides: Record<string, any> = {}) => ({
    _id: validId,
    email: 'profile@example.com',
    username: 'profile-user',
    phone: '0912345678',
    role,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    isOAuthUser: false,
    banCounts: 0,
    createdAt,
    updatedAt,
    ...overrides,
  });

  const createAddress = () => ({
    _id: 'address-1',
    address: '123 Nguyen Hue',
    ward: '00001',
    district: '001',
    province: '79',
    provinceName: 'Ho Chi Minh City',
    districtName: 'District 1',
    wardName: 'Ben Nghe',
  });

  const createGoogleIframe = () => ({
    addressId: 'address-1',
    googleMapIframe: '<iframe />',
    zoomLevel: 15,
  });

  beforeEach(async () => {
    accountRepository = { findAccountById: jest.fn() };
    addressRepository = { findByAccountId: jest.fn() };
    googleIframeRepository = { findByAddressId: jest.fn() };
    generalAccountRepository = { findByAccountId: jest.fn() };
    clinicAdminInfoRepository = { findByAccountId: jest.fn() };
    clinicManagerInfoRepository = { findByAccountId: jest.fn() };
    clinicStaffRepository = { findByAccountId: jest.fn() };
    doctorInfoRepository = { findByAccountId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        AccountsService,
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: generalAccountRepository },
        { provide: CodeVerificationRepository, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ClinicManagerInformationRepository, useValue: clinicManagerInfoRepository },
        { provide: ClinicStaffInformationRepository, useValue: clinicStaffRepository },
        { provide: DoctorInformationRepository, useValue: doctorInfoRepository },
        { provide: ClinicAdminInformationRepository, useValue: clinicAdminInfoRepository },
        { provide: AddressRepository, useValue: addressRepository },
        { provide: GoogleIframeRepository, useValue: googleIframeRepository },
        { provide: ClinicSubscriptionRepository, useValue: {} },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: MailerService, useValue: {} },
        { provide: ClinicsLegalDocumentsRepository, useValue: {} },
        { provide: TransactionRepository, useValue: {} },
        { provide: ZaloWebhookService, useValue: {} },
        { provide: ContractPackageRepository, useValue: {} },
      ],
    }).compile();

    controller = module.get(AccountsController);
    service = module.get(AccountsService);
  });

  it('UT-07-01: View PATIENT or ADMIN profile with general account data.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.PATIENT));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(createGoogleIframe());
    generalAccountRepository.findByAccountId.mockResolvedValue({
      fullName: 'Patient User',
      profilePicture: 'https://example.com/patient.jpg',
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.fullName).toBe('Patient User');
    expect(result.data.address).toBe('123 Nguyen Hue');
    expect(result.data.googleMapIframe).toBe('<iframe />');
  });

  it('UT-07-02: View CLINIC_ADMIN profile with clinic admin information.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.CLINIC_ADMIN));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(createGoogleIframe());
    clinicAdminInfoRepository.findByAccountId.mockResolvedValue({
      clinicName: 'Bonix Clinic',
      bankName: 'VCB',
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.clinicName).toBe('Bonix Clinic');
    expect(result.data.bankName).toBe('VCB');
  });

  it('UT-07-03: View CLINIC_MANAGER profile with clinic manager information.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.CLINIC_MANAGER));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(createGoogleIframe());
    clinicManagerInfoRepository.findByAccountId.mockResolvedValue({
      clinicBranchName: 'District 1 Branch',
      fullName: 'Manager User',
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.clinicBranchName).toBe('District 1 Branch');
    expect(result.data.fullName).toBe('Manager User');
  });

  it('UT-07-04: View CLINIC_STAFF profile with clinic staff information.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.CLINIC_STAFF));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(createGoogleIframe());
    clinicStaffRepository.findByAccountId.mockResolvedValue({
      fullName: 'Staff User',
      clinicRole: ClinicRole.STAFF,
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.fullName).toBe('Staff User');
    expect(result.data.clinicRole).toBe(ClinicRole.STAFF);
  });

  it('UT-07-05: View DOCTOR profile with doctor information.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.DOCTOR));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(createGoogleIframe());
    doctorInfoRepository.findByAccountId.mockResolvedValue({
      fullName: 'Doctor User',
      academicDegree: 'MD',
      position: 'Cardiologist',
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.fullName).toBe('Doctor User');
    expect(result.data.academicDegree).toBe('MD');
    expect(result.data.position).toBe('Cardiologist');
  });

  it('UT-07-06: Reject missing or invalid JWT.', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.findOne) ?? [];
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.findOne) ?? [];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual(
      expect.arrayContaining([
        AccountRole.ADMIN,
        AccountRole.PATIENT,
        AccountRole.DOCTOR,
        AccountRole.CLINIC_STAFF,
        AccountRole.CLINIC_ADMIN,
        AccountRole.CLINIC_MANAGER,
      ]),
    );
  });

  it('UT-07-07: Reject invalid UUID path parameter.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('not-a-uuid', { type: 'param', metatype: String, data: 'id' }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-07-08: Reject non-existent account id.', async () => {
    accountRepository.findAccountById.mockResolvedValue(null);

    await expect(service.getAccountInformationByRole(validId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getAccountInformationByRole(validId)).rejects.toThrow(
      'User not found',
    );
  });

  it('UT-07-09: Reject account role hitting default switch branch.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount('UNKNOWN_ROLE'));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(createGoogleIframe());

    await expect(service.getAccountInformationByRole(validId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getAccountInformationByRole(validId)).rejects.toThrow(
      'User not found',
    );
  });

  it('UT-07-10: Return profile when address does not exist.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.PATIENT));
    addressRepository.findByAccountId.mockResolvedValue(null);
    googleIframeRepository.findByAddressId.mockResolvedValue(null);
    generalAccountRepository.findByAccountId.mockResolvedValue({
      fullName: 'No Address User',
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.fullName).toBe('No Address User');
    expect(result.data.address).toBeUndefined();
    expect(result.data.googleMapIframe).toBeUndefined();
  });

  it('UT-07-11: Return profile when address exists but google iframe does not exist.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount(AccountRole.CLINIC_ADMIN));
    addressRepository.findByAccountId.mockResolvedValue(createAddress());
    googleIframeRepository.findByAddressId.mockResolvedValue(null);
    clinicAdminInfoRepository.findByAccountId.mockResolvedValue({
      clinicName: 'Iframe Missing Clinic',
    });

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Users fetched successfully');
    expect(result.data.clinicName).toBe('Iframe Missing Clinic');
    expect(result.data.address).toBe('123 Nguyen Hue');
    expect(result.data.googleMapIframe).toBeUndefined();
  });
});
