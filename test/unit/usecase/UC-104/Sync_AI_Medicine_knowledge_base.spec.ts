import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AdminController } from '../../../../src/modules/admin/admin.controller';
import { AdminService } from '../../../../src/modules/admin/admin.service';

describe('UC-104 Sync AI Medicine knowledge base', () => {
  const createContext = () =>
    ({
      dataSource: {
        query: jest.fn().mockResolvedValue(undefined),
      },
    }) as any;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('UT-104-01: Sync success when table has old records.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { synced: 5 } }),
    } as any);

    const result = await AdminService.prototype.syncKnowledgeBaseMedicine.call(context);

    expect(context.dataSource.query).toHaveBeenCalledWith('DELETE FROM knowledge_base_medicines');
    expect(result.message).toBe('Knowledge base synced successfully');
  });

  it('UT-104-02: Sync success when table already empty.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { synced: 0 } }),
    } as any);

    const result = await AdminService.prototype.syncKnowledgeBaseMedicine.call(context);

    expect(result.statusCode).toBe(0);
    expect(context.dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('UT-104-03: Returned payload contains statusCode/message/data.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { medicines: 12 } }),
    } as any);

    const result = await AdminService.prototype.syncKnowledgeBaseMedicine.call(context);

    expect(result).toEqual(
      expect.objectContaining({
        statusCode: 0,
        message: expect.any(String),
        data: expect.any(Object),
      }),
    );
  });

  it('UT-104-04: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);

    expect(guards).toHaveLength(2);
  });

  it('UT-104-05: Non-admin role access.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController.prototype.syncKnowledgeBaseMedicines);

    expect(roles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-104-06: AI endpoint responds ok=false.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
    } as any);

    await expect(AdminService.prototype.syncKnowledgeBaseMedicine.call(context)).rejects.toThrow(BadRequestException);
    await expect(AdminService.prototype.syncKnowledgeBaseMedicine.call(context)).rejects.toThrow('Error calling AI sync API');
  });

  it('UT-104-07: AI endpoint throws runtime/network error.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('network down'));

    await expect(AdminService.prototype.syncKnowledgeBaseMedicine.call(context)).rejects.toThrow('Error calling AI sync API');
  });

  it('UT-104-08: JSON parse/runtime error in try-catch path.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('invalid json');
      },
    } as any);

    await expect(AdminService.prototype.syncKnowledgeBaseMedicine.call(context)).rejects.toThrow('Error calling AI sync API');
  });

  it('UT-104-09: Empty sync data object still success.', async () => {
    const context = createContext();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as any);

    const result = await AdminService.prototype.syncKnowledgeBaseMedicine.call(context);

    expect(result.statusCode).toBe(0);
    expect(result.data).toEqual({});
  });

  it('UT-104-10: Large sync data object still success.', async () => {
    const context = createContext();
    const bigData = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]));
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: bigData }),
    } as any);

    const result = await AdminService.prototype.syncKnowledgeBaseMedicine.call(context);

    expect(Object.keys(result.data)).toHaveLength(200);
  });
});
