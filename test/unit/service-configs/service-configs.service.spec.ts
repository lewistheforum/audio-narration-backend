import { Test, TestingModule } from '@nestjs/testing';
import { ServiceConfigsService } from '../../../src/modules/service-configs/service-configs.service';
import { DataSource } from 'typeorm';
import { ClinicServiceConfigRepository } from '../../../src/modules/service-configs/repositories/clinic-service-config.repository';
import { NotFoundException } from '@nestjs/common';

describe('ServiceConfigsService - Manager APIs', () => {
    let service: ServiceConfigsService;
    let dataSource: any;
    let queryRunner: any;
    let clinicServiceConfigRepository: any;

    const mockClinicManagerId = 'manager-123';

    beforeEach(async () => {
        queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            query: jest.fn(),
        };

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn(),
            getRawOne: jest.fn(),
        };

        dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            query: jest.fn(),
        };

        clinicServiceConfigRepository = {};

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ServiceConfigsService,
                {
                    provide: DataSource,
                    useValue: dataSource,
                },
                {
                    provide: ClinicServiceConfigRepository,
                    useValue: clinicServiceConfigRepository,
                },
            ],
        }).compile();

        service = module.get<ServiceConfigsService>(ServiceConfigsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getServicesByManager', () => {
        it('should return mapped existing clinic services for the given manager', async () => {
            const queryBuilder = dataSource.createQueryBuilder();
            const mockRawData = [
                {
                    _id: 'service-1',
                    categoryId: 'cat-1',
                    serviceName: 'Test Service',
                    serviceCode: 'TS',
                    description: 'Desc',
                    serviceFunctions: '{1,2}',
                    isActive: true,
                    price: '1000',
                    discount: '10',
                    durationMin: 30,
                    noteForPatient: 'Note',
                },
            ];
            queryBuilder.getRawMany.mockResolvedValue(mockRawData);

            const result = await service.getServicesByManager(mockClinicManagerId);

            expect(queryBuilder.select).toHaveBeenCalled();
            expect(queryBuilder.from).toHaveBeenCalledWith('clinic_services', 'cs');
            expect(queryBuilder.where).toHaveBeenCalledWith('csc.clinic_id = :clinicManagerId', { clinicManagerId: mockClinicManagerId });
            expect(result).toHaveLength(1);
            expect(result[0].serviceFunctions).toEqual(['1', '2']);
            expect(result[0].price).toBe(1000);
            expect(result[0].discount).toBe(10);
        });
    });

    describe('getServiceDetail', () => {
        it('should throw NotFoundException if service detail does not exist', async () => {
            const queryBuilder = dataSource.createQueryBuilder();
            queryBuilder.getRawOne.mockResolvedValue(null);

            await expect(service.getServiceDetail(mockClinicManagerId, 'non-existent')).rejects.toThrow(NotFoundException);
        });

        it('should return service detail when found', async () => {
            const queryBuilder = dataSource.createQueryBuilder();
            const mockRawData = {
                _id: 'service-1',
                categoryId: 'cat-1',
                serviceName: 'Test Service',
                serviceCode: 'TS',
                serviceFunctions: '{1,2}',
                isActive: true,
                price: '1000',
                discount: '10',
            };
            queryBuilder.getRawOne.mockResolvedValue(mockRawData);

            const result = await service.getServiceDetail(mockClinicManagerId, 'service-1');

            expect(result._id).toBe('service-1');
            expect(result.price).toBe(1000);
            expect(result.discount).toBe(10);
            expect(result.serviceFunctions).toEqual(['1', '2']);
        });
    });

    describe('createService', () => {
        it('should throw NotFoundException if category is not found', async () => {
            dataSource.query.mockResolvedValueOnce([]); // mock category check returns empty

            const dto = { categoryId: 'cat-x' };
            await expect(service.createService(mockClinicManagerId, dto)).rejects.toThrow(NotFoundException);
        });

        it('should create service and config successfully via transaction', async () => {
            dataSource.query.mockResolvedValueOnce([{ _id: 'cat-1' }]); // category check
            dataSource.query.mockResolvedValueOnce([]); // existing code check

            queryRunner.query.mockResolvedValueOnce([{ _id: 'new-service-id', category_id: 'cat-1', service_name: 'Name', service_code: 'Code', description: 'Desc', service_functions: 'Funcs', is_active: true }]); // create _services
            queryRunner.query.mockResolvedValueOnce([{ price: '200', discount: '5', duration_min: 15, note_for_patient: 'note' }]); // create config

            const dto = { categoryId: 'cat-1', serviceCode: 'Code', serviceName: 'Name', price: 200, discount: 5, durationMin: 15 };
            const result = await service.createService(mockClinicManagerId, dto);

            expect(queryRunner.startTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();

            expect(result._id).toBe('new-service-id');
            expect(result.price).toBe(200);
            expect(result.discount).toBe(5);
        });

        it('should rollback on error in createService', async () => {
            dataSource.query.mockResolvedValueOnce([{ _id: 'cat-1' }]); // category check
            dataSource.query.mockResolvedValueOnce([]); // existing code check

            queryRunner.query.mockRejectedValueOnce(new Error('DB Error'));

            const dto = { categoryId: 'cat-1', serviceCode: 'Code' };
            await expect(service.createService(mockClinicManagerId, dto)).rejects.toThrow('DB Error');

            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });

    describe('updateService', () => {
        it('should update service successfully', async () => {
            const mockRawData = {
                _id: 'service-1', price: '1000', discount: '10'
            };
            // Mock getServiceDetail
            jest.spyOn(service, 'getServiceDetail').mockResolvedValue(mockRawData);

            const dto = { serviceName: 'New Name', price: 1500 };

            queryRunner.query.mockResolvedValue([]);

            const result = await service.updateService(mockClinicManagerId, 'service-1', dto);

            expect(queryRunner.startTransaction).toHaveBeenCalled();
            expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE clinic_services'), expect.any(Array));
            expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE clinic_service_config'), expect.any(Array));
            expect(queryRunner.commitTransaction).toHaveBeenCalled();

            expect(result).toEqual(mockRawData); // since it returns getServiceDetail return value
        });
    });

    describe('toggleServiceStatus', () => {
        it('should toggle service status successfully', async () => {
            const mockRawData = {
                _id: 'service-1', isActive: true
            };
            // Mock getServiceDetail
            jest.spyOn(service, 'getServiceDetail').mockResolvedValue(mockRawData);

            queryRunner.query.mockResolvedValue([]);

            const result = await service.toggleServiceStatus(mockClinicManagerId, 'service-1', false);

            expect(queryRunner.startTransaction).toHaveBeenCalled();
            expect(queryRunner.query).toHaveBeenCalledWith(
                'UPDATE clinic_services SET is_active = $1, updated_at = NOW() WHERE _id = $2',
                [false, 'service-1']
            );
            expect(queryRunner.query).toHaveBeenCalledWith(
                'UPDATE clinic_service_config SET is_active = $1, updated_at = NOW() WHERE service_id = $2 AND clinic_id = $3',
                [false, 'service-1', mockClinicManagerId]
            );
            expect(queryRunner.commitTransaction).toHaveBeenCalled();

            expect(result).toEqual(mockRawData); // since it returns getServiceDetail return value
        });
    });
});
