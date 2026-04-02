import { Test, TestingModule } from '@nestjs/testing';
import { ZaloWebhookService } from '../../../src/modules/accounts/zalo-webhook.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

describe('ZaloWebhookService', () => {
  let service: ZaloWebhookService;
  let httpService: { post: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('https://n8n.example.com/webhook'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZaloWebhookService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(ZaloWebhookService);

    jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);
    jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendFriendRequest', () => {
    it('loads webhook URL from config key on construction', () => {
      expect(configService.get).toHaveBeenCalledWith(
        'N8N_ZALO_FRIEND_REQUEST_WEBHOOK_URL',
      );
    });

    it('returns early when phone is missing', async () => {
      await service.sendFriendRequest(undefined, 'UnitTest');

      expect((service as any).logger.warn).toHaveBeenCalledWith(
        '[UnitTest] No phone number provided for Zalo friend request',
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('returns early when webhook url is not configured', async () => {
      configService.get.mockReturnValueOnce(undefined);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ZaloWebhookService,
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get(ZaloWebhookService);
      jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      await service.sendFriendRequest('0912 345 678', 'UnitTest');

      expect((service as any).logger.warn).toHaveBeenCalledWith(
        '[UnitTest] Zalo friend request webhook URL is not configured',
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('normalizes phone and posts to webhook', async () => {
      httpService.post.mockReturnValueOnce(of({ data: { ok: true } }));

      await service.sendFriendRequest(' 0912-345(678) ', 'UnitTest');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook',
        { phone: '0912345678' },
      );
    });

    it('does not throw when webhook call fails', async () => {
      httpService.post.mockReturnValueOnce(
        throwError(() => ({ message: 'network fail', stack: 'stack' })),
      );

      await expect(
        service.sendFriendRequest('0912345678', 'UnitTest'),
      ).resolves.toBeUndefined();

      expect((service as any).logger.error).toHaveBeenCalled();
    });

    it('uses default source Unknown when omitted', async () => {
      await service.sendFriendRequest(undefined);

      expect((service as any).logger.warn).toHaveBeenCalledWith(
        '[Unknown] No phone number provided for Zalo friend request',
      );
    });

    it.todo(
      'Nghiệp vụ webhook: luôn ghi log theo source để truy vết sự kiện gửi yêu cầu kết bạn',
    );
    it.todo(
      'Nghiệp vụ webhook: dữ liệu phone gửi đi phải được chuẩn hóa trước khi gọi dịch vụ ngoài',
    );
    it.todo(
      'Nghiệp vụ webhook: lỗi tích hợp ngoài không được làm gián đoạn luồng nghiệp vụ chính',
    );
  });
});
