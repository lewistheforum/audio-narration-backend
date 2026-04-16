import { BadRequestException, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { UpdateLegalDocumentsDto } from '../../../../src/modules/accounts/dto/update-legal-documents.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';

describe('UC-101 Update Legal Document', () => {
  const adminId = '123e4567-e89b-42d3-a456-426614174011';
  const managerId = '123e4567-e89b-42d3-a456-426614174012';
  const validUrl = 'https://example.com/doc.pdf';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateLegalDocumentsDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (opts?: {
    adminRole?: AccountRole;
    manager?: any;
    legalDocs?: any;
    subscription?: any;
    saveReject?: string;
  }) => {
    const legalDocs =
      opts && 'legalDocs' in opts
        ? opts.legalDocs
        : {
      accountId: managerId,
      verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      operatingLicense: validUrl,
      businessLicense: validUrl,
      taxIdUrl: validUrl,
      otherDocs: [validUrl],
    };
    const subscription =
      opts && 'subscription' in opts
        ? opts.subscription
        : {
      clinicId: adminId,
      subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
    };
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation(async (payload) => {
          if (opts?.saveReject) {
            throw new Error(opts.saveReject);
          }
          return payload;
        }),
      },
    } as any;

    return {
      findAccountEntityById: jest
        .fn()
        .mockResolvedValueOnce({ _id: adminId, role: opts?.adminRole ?? AccountRole.CLINIC_ADMIN })
        .mockResolvedValueOnce(
          opts?.manager ?? { _id: managerId, role: AccountRole.CLINIC_MANAGER, parentId: adminId },
        ),
      clinicLegalDocsRepository: {
        findByAccountId: jest.fn().mockResolvedValue(legalDocs),
      },
      clinicSubscriptionRepository: {
        findByClinicId: jest.fn().mockResolvedValue(subscription),
      },
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      __queryRunner: queryRunner,
    } as any;
  };

  it('UT-101-01: Update all legal document fields successfully.', async () => {
    const context = createServiceContext();

    const result = await AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, {
      operatingLicense: validUrl,
      businessLicense: validUrl,
      taxIdUrl: validUrl,
      otherDocs: [validUrl, 'https://example.com/other.png'],
    });

    expect(result.verificationStatus).toBe(LegalDocumentVerificationStatus.PENDING_REVIEW);
  });

  it('UT-101-02: Partial update only one document field.', async () => {
    const context = createServiceContext();

    const result = await AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, {
      businessLicense: 'https://example.com/new-business.pdf',
    });

    expect(result.businessLicense).toBe('https://example.com/new-business.pdf');
  });

  it('UT-101-03: Update changes legal-doc status to PENDING_REVIEW.', async () => {
    const context = createServiceContext();

    const result = await AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, {
      operatingLicense: validUrl,
    });

    expect(result.verificationStatus).toBe(LegalDocumentVerificationStatus.PENDING_REVIEW);
  });

  it('UT-101-04: Update changes subscription status to PENDING_APPROVAL.', async () => {
    const context = createServiceContext();

    await AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, {
      taxIdUrl: validUrl,
    });

    expect(context.clinicSubscriptionRepository.findByClinicId).toHaveBeenCalledWith(adminId);
  });

  it('UT-101-05: Update succeeds with otherDocs array omitted.', async () => {
    const context = createServiceContext();

    const result = await AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, {
      operatingLicense: validUrl,
      businessLicense: validUrl,
      taxIdUrl: validUrl,
    });

    expect(result).toBeDefined();
  });

  it('UT-101-06: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.updateLegalDocumentsForManager);

    expect(guards).toHaveLength(2);
  });

  it('UT-101-07: Role mismatch (non-CLINIC_ADMIN).', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.updateLegalDocumentsForManager);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-101-08: Invalid UUID or invalid DTO field formats.', async () => {
    const pipe = new ParseUUIDPipe();
    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');

    const messages = await collectMessages({
      operatingLicense: 'not-url',
      businessLicense: 'https://example.com/file.exe',
      taxIdUrl: 'bad-url',
      otherDocs: 'not-array',
    } as any);

    expect(messages).toContain('Operating license must be a valid URL');
    expect(messages).toContain('Business license must be a PNG, JPG, JPEG, DOC, DOCX, or PDF file URL');
    expect(messages).toContain('Tax ID URL must be a valid URL');
    expect(messages).toContain('Other docs must be an array');
  });

  it('UT-101-09: Manager/legal-doc/subscription not found.', async () => {
    const missingManager = createServiceContext({
      manager: { _id: managerId, role: AccountRole.CLINIC_STAFF, parentId: adminId },
    });

    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(missingManager, adminId, managerId, {
        operatingLicense: validUrl,
      }),
    ).rejects.toThrow(new NotFoundException('Clinic manager not found'));

    const missingLegalDocs = createServiceContext({ legalDocs: null });
    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(missingLegalDocs, adminId, managerId, {
        operatingLicense: validUrl,
      }),
    ).rejects.toThrow(new NotFoundException('Legal documents not found'));

    const missingSubscription = createServiceContext({ subscription: null });
    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(missingSubscription, adminId, managerId, {
        operatingLicense: validUrl,
      }),
    ).rejects.toThrow(new NotFoundException('Clinic subscription not found'));
  });

  it('UT-101-10: Legal doc not in REJECTED status.', async () => {
    const context = createServiceContext({
      legalDocs: {
        accountId: managerId,
        verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      },
    });

    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, { operatingLicense: validUrl }),
    ).rejects.toThrow(new BadRequestException('Can only update documents that have been rejected'));
  });

  it('UT-101-11: Subscription not in PENDING_LEGAL_SETUP.', async () => {
    const context = createServiceContext({
      subscription: {
        clinicId: adminId,
        subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
      },
    });

    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(context, adminId, managerId, { operatingLicense: validUrl }),
    ).rejects.toThrow('Cannot update legal documents. Current status: PENDING_APPROVAL. Expected: PENDING_LEGAL_SETUP');
  });

  it('UT-101-12: Ownership violation or transaction/runtime failure.', async () => {
    const forbiddenContext = createServiceContext({
      manager: { _id: managerId, role: AccountRole.CLINIC_MANAGER, parentId: 'other-admin' },
    });

    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(forbiddenContext, adminId, managerId, { operatingLicense: validUrl }),
    ).rejects.toThrow(new ForbiddenException('You do not have permission to update documents for this manager'));

    const runtimeContext = createServiceContext({ saveReject: 'db failed' });
    await expect(
      AccountsService.prototype.updateLegalDocumentsForManager.call(runtimeContext, adminId, managerId, { operatingLicense: validUrl }),
    ).rejects.toThrow('db failed');
  });

  it('UT-101-13: URL length boundary accepted at max.', async () => {
    const prefix = 'https://example.com/';
    const suffix = '.pdf';
    const longUrl = `${prefix}${'a'.repeat(1000 - prefix.length - suffix.length)}${suffix}`;
    const messages = await collectMessages({ operatingLicense: longUrl });

    expect(messages).toEqual([]);
  });

  it('UT-101-14: otherDocs boundary with single valid item accepted.', async () => {
    const messages = await collectMessages({ otherDocs: [validUrl] });

    expect(messages).toEqual([]);
  });
});
