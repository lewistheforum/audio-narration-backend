import { BadRequestException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { AdminController } from '../../../../src/modules/admin/admin.controller';
import { AdminService } from '../../../../src/modules/admin/admin.service';
import { RejectRegistrationDto } from '../../../../src/modules/admin/dto/reject-registration.dto';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';

describe('UC-102 Approve Reject Legal Document', () => {
  const subscriptionId = '123e4567-e89b-42d3-a456-426614174013';
  const clinicAdminId = '123e4567-e89b-42d3-a456-426614174014';
  const managerId = '123e4567-e89b-42d3-a456-426614174015';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(RejectRegistrationDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (opts?: {
    subscription?: any;
    clinicAdmin?: any;
    legalDocs?: any;
    saveReject?: string;
  }) => {
    const subscription =
      opts && 'subscription' in opts
        ? opts.subscription
        : { _id: subscriptionId, clinicId: clinicAdminId, subscriptionStatus: RegistrationStatus.PENDING_APPROVAL, serviceId: 'svc-1' };
    const clinicAdmin =
      opts && 'clinicAdmin' in opts
        ? opts.clinicAdmin
        : {
            _id: clinicAdminId,
            email: 'clinic@example.com',
            clinicAdminInformation: { clinicName: 'Clinic A' },
            children: [{ _id: managerId, role: AccountRole.CLINIC_MANAGER, status: AccountStatus.PENDING_APPROVAL }],
          };
    const legalDocs =
      opts && 'legalDocs' in opts
        ? opts.legalDocs
        : { accountId: managerId, verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW, rejectionReason: null };

    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation(async (_entity, payload) => {
          if (opts?.saveReject) {
            throw new Error(opts.saveReject);
          }
          return payload;
        }),
      },
    } as any;

    return {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      clinicSubscriptionRepository: { findById: jest.fn().mockResolvedValue(subscription) },
      accountRepository: { findOne: jest.fn().mockResolvedValue(clinicAdmin) },
      legalDocumentsRepository: { findByAccountId: jest.fn().mockResolvedValue(legalDocs) },
      mailerService: {
        sendRegistrationApprovedEmail: jest.fn().mockResolvedValue(undefined),
        sendRegistrationRejectedEmail: jest.fn().mockResolvedValue(undefined),
      },
      __queryRunner: queryRunner,
    } as any;
  };

  it('UT-102-01: Approve registration successfully from pending approval state.', async () => {
    const context = createServiceContext();

    const result = await AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Registration approved successfully');
  });

  it('UT-102-02: Approve flow sets legal document status to APPROVED.', async () => {
    const context = createServiceContext();

    await AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId);

    const savedLegalDocs = context.__queryRunner.manager.save.mock.calls[0][1];
    expect(savedLegalDocs.verificationStatus).toBe(LegalDocumentVerificationStatus.APPROVED);
  });

  it('UT-102-03: Approve flow sets clinic manager status to ACTIVE.', async () => {
    const context = createServiceContext();

    await AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId);

    const savedManager = context.__queryRunner.manager.save.mock.calls[1][1];
    expect(savedManager.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-102-04: Approve flow sets subscription status to PENDING_PAYMENT.', async () => {
    const context = createServiceContext();

    await AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId);

    const savedSubscription = context.__queryRunner.manager.save.mock.calls[2][1];
    expect(savedSubscription.subscriptionStatus).toBe(RegistrationStatus.PENDING_PAYMENT);
  });

  it('UT-102-05: Reject registration successfully with valid reason.', async () => {
    const context = createServiceContext();

    const result = await AdminService.prototype.rejectRegistrationBySubscriptionId.call(
      context,
      subscriptionId,
      'Business license has expired.',
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Registration rejected');
  });

  it('UT-102-06: Reject flow sets legal docs REJECTED and subscription PENDING_LEGAL_SETUP.', async () => {
    const context = createServiceContext();

    await AdminService.prototype.rejectRegistrationBySubscriptionId.call(context, subscriptionId, 'Need more valid documents.');

    const savedLegalDocs = context.__queryRunner.manager.save.mock.calls[0][1];
    const savedSubscription = context.__queryRunner.manager.save.mock.calls[2][1];
    expect(savedLegalDocs.verificationStatus).toBe(LegalDocumentVerificationStatus.REJECTED);
    expect(savedSubscription.subscriptionStatus).toBe(RegistrationStatus.PENDING_LEGAL_SETUP);
  });

  it('UT-102-07: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);

    expect(guards).toHaveLength(2);
  });

  it('UT-102-08: Non-admin role tries approve/reject endpoint.', () => {
    const approveRoles = Reflect.getMetadata(ROLES_KEY, AdminController.prototype.approveRegistrationBySubscriptionId);
    const rejectRoles = Reflect.getMetadata(ROLES_KEY, AdminController.prototype.rejectRegistrationBySubscriptionId);

    expect(approveRoles).toEqual([AccountRole.ADMIN]);
    expect(rejectRoles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-102-09: Invalid subscription UUID format.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-102-10: Subscription not found.', async () => {
    const context = createServiceContext({ subscription: null });

    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId)).rejects.toThrow(
      new NotFoundException('Subscription not found'),
    );
  });

  it('UT-102-11: Subscription not in PENDING_APPROVAL status.', async () => {
    const context = createServiceContext({
      subscription: { _id: subscriptionId, clinicId: clinicAdminId, subscriptionStatus: RegistrationStatus.PENDING_PAYMENT },
    });

    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId)).rejects.toThrow(
      new BadRequestException('Subscription is not in PENDING_APPROVAL status'),
    );
  });

  it('UT-102-12: Clinic admin/manager/legal docs not found.', async () => {
    const missingAdmin = createServiceContext({ clinicAdmin: null });
    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(missingAdmin, subscriptionId)).rejects.toThrow(
      new NotFoundException('Clinic admin not found'),
    );

    const missingManager = createServiceContext({ clinicAdmin: { _id: clinicAdminId, children: [] } });
    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(missingManager, subscriptionId)).rejects.toThrow(
      new NotFoundException('Clinic manager not found'),
    );

    const missingLegalDocs = createServiceContext({ legalDocs: null });
    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(missingLegalDocs, subscriptionId)).rejects.toThrow(
      new NotFoundException('Legal documents not found'),
    );
  });

  it('UT-102-13: Legal docs not in PENDING_REVIEW status.', async () => {
    const context = createServiceContext({
      legalDocs: { accountId: managerId, verificationStatus: LegalDocumentVerificationStatus.REJECTED },
    });

    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId)).rejects.toThrow(
      new BadRequestException('Legal documents are not in PENDING_REVIEW status'),
    );
  });

  it('UT-102-14: Runtime transaction failure causes server error.', async () => {
    const context = createServiceContext({ saveReject: 'db failed' });

    await expect(AdminService.prototype.approveRegistrationBySubscriptionId.call(context, subscriptionId)).rejects.toThrow('db failed');
    expect(context.__queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-102-15: Reject reason length exactly 10 chars accepted.', async () => {
    const messages = await collectMessages({ reason: '1234567890' });

    expect(messages).toEqual([]);
  });

  it('UT-102-16: Reject reason length exactly 1000 chars accepted.', async () => {
    const messages = await collectMessages({ reason: 'A'.repeat(1000) });

    expect(messages).toEqual([]);
  });
});
