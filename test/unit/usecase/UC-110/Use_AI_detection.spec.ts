import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { of, throwError } from 'rxjs';

import { AiController } from '../../../../src/modules/ai/ai.controller';
import { AiService } from '../../../../src/modules/ai/ai.service';
import { FractureDetectionRequestDto } from '../../../../src/modules/ai/dto/fracture-detection-request.dto';

describe('UC-110 Use AI detection', () => {
  const validImage = 'data:image/jpeg;base64,ZmFrZQ==';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(FractureDetectionRequestDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createService = () =>
    ({
      httpService: {
        post: jest.fn(),
      },
    }) as any;

  it('UT-110-01: Detect fracture success with valid image and notes.', async () => {
    const service = createService();
    service.httpService.post.mockReturnValue(of({ data: { ok: true } }));

    const result = await AiService.prototype.detectFracture.call(service, {
      imageBase64: validImage,
      notes: 'patient note',
    });

    expect(result.ok).toBe(true);
  });

  it('UT-110-02: Detect fracture success with notes omitted.', async () => {
    const service = createService();
    service.httpService.post.mockReturnValue(of({ data: { ok: true } }));

    const result = await AiService.prototype.detectFracture.call(service, {
      imageBase64: validImage,
    });

    expect(result).toEqual({ ok: true });
  });

  it('UT-110-03: Detect fracture success and returns upstream payload.', async () => {
    const service = createService();
    const payload = { label: 'no-fracture', confidence: 0.91 };
    service.httpService.post.mockReturnValue(of({ data: payload }));

    const result = await AiService.prototype.detectFracture.call(service, {
      imageBase64: validImage,
      notes: 'n',
    });

    expect(result).toEqual(payload);
  });

  it('UT-110-04: imageBase64 invalid data-uri format.', async () => {
    const service = createService();

    await expect(
      AiService.prototype.detectFracture.call(service, {
        imageBase64: 'plain_base64',
        notes: 'n',
      }),
    ).rejects.toThrow('Failed to process fracture detection');
  });

  it('UT-110-05: imageBase64 missing/empty validation fail.', async () => {
    const missingMessages = await collectMessages({ notes: 'x' });
    const emptyMessages = await collectMessages({ imageBase64: '', notes: 'x' });

    expect(missingMessages.some((m) => m.includes('should not be empty'))).toBe(true);
    expect(emptyMessages.some((m) => m.includes('should not be empty'))).toBe(true);
  });

  it('UT-110-06: notes invalid type validation fail.', async () => {
    const messages = await collectMessages({ imageBase64: validImage, notes: 123 as any });

    expect(messages.some((m) => m.includes('must be a string'))).toBe(true);
  });

  it('UT-110-07: Upstream AI API returns error response.', async () => {
    const service = createService();
    const error: any = new Error('request failed');
    error.response = { data: { message: 'upstream bad request' } };
    service.httpService.post.mockReturnValue(throwError(() => error));

    await expect(AiService.prototype.detectFracture.call(service, { imageBase64: validImage, notes: 'x' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('UT-110-08: Upstream AI API throws runtime/network error.', async () => {
    const service = createService();
    service.httpService.post.mockReturnValue(throwError(() => new Error('network down')));

    await expect(AiService.prototype.detectFracture.call(service, { imageBase64: validImage, notes: 'x' })).rejects.toThrow(
      'Failed to process fracture detection',
    );
  });

  it('UT-110-09: Endpoint reachable without JWT (security gap observation).', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AiController);

    expect(guards).toBeUndefined();
  });

  it('UT-110-10: Minimal valid data URI payload accepted.', async () => {
    const messages = await collectMessages({ imageBase64: 'data:image/png;base64,AA==' });

    expect(messages).toEqual([]);
  });

  it('UT-110-11: Large valid base64 image payload accepted.', async () => {
    const large = `data:image/jpeg;base64,${'A'.repeat(5000)}`;
    const messages = await collectMessages({ imageBase64: large, notes: 'ok' });

    expect(messages).toEqual([]);
  });
});
