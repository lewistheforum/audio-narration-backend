import { Test, TestingModule } from '@nestjs/testing';
import { ManagerServiceConfigsController } from '../../../src/modules/service-configs/service-configs.controller';
import { ServiceConfigsService } from '../../../src/modules/service-configs/service-configs.service';

describe('ManagerServiceConfigsController', () => {
    let controller: ManagerServiceConfigsController;
    let serviceConfigsService: any;

    const mockClinicManagerId = 'manager-123';
    const mockRequest = {
        user: {
            _id: mockClinicManagerId,
        },
    };

    beforeEach(async () => {
        serviceConfigsService = {
            getServicesByManager: jest.fn(),
            getServiceDetail: jest.fn(),
            createService: jest.fn(),
            updateService: jest.fn(),
            toggleServiceStatus: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ManagerServiceConfigsController],
            providers: [
                {
                    provide: ServiceConfigsService,
                    useValue: serviceConfigsService,
                },
            ],
        }).compile();

        controller = module.get<ManagerServiceConfigsController>(ManagerServiceConfigsController);
    });

    describe('getServicesByManager', () => {
        it('should call getServicesByManager with correct manager ID', async () => {
            const mockResult = [{ _id: '1', serviceName: 'Test Service' }];
            serviceConfigsService.getServicesByManager.mockResolvedValue(mockResult);

            const result = await controller.getServicesByManager(mockRequest);

            expect(serviceConfigsService.getServicesByManager).toHaveBeenCalledWith(mockClinicManagerId);
            expect(result).toEqual(mockResult);
        });
    });

    describe('getServiceDetail', () => {
        it('should call getServiceDetail with correct manager ID and service ID', async () => {
            const mockServiceId = 'service-123';
            const mockResult = { _id: mockServiceId, serviceName: 'Test Service' };
            serviceConfigsService.getServiceDetail.mockResolvedValue(mockResult);

            const result = await controller.getServiceDetail(mockRequest, mockServiceId);

            expect(serviceConfigsService.getServiceDetail).toHaveBeenCalledWith(mockClinicManagerId, mockServiceId);
            expect(result).toEqual(mockResult);
        });
    });

    describe('createService', () => {
        it('should call createService with correct manager ID and DTO', async () => {
            const mockDto: any = {
                categoryId: 'cat-1',
                serviceName: 'New Service',
                serviceCode: 'NS-01',
                description: 'Testing',
                price: 100000,
                durationMin: 30,
            };
            const mockResult = { _id: 'service-123', ...mockDto };
            serviceConfigsService.createService.mockResolvedValue(mockResult);

            const result = await controller.createService(mockRequest, mockDto);

            expect(serviceConfigsService.createService).toHaveBeenCalledWith(mockClinicManagerId, mockDto);
            expect(result).toEqual(mockResult);
        });
    });

    describe('updateService', () => {
        it('should call updateService with correct manager ID, service ID, and DTO', async () => {
            const mockServiceId = 'service-123';
            const mockDto: any = {
                price: 150000,
            };
            const mockResult = { _id: mockServiceId, price: 150000 };
            serviceConfigsService.updateService.mockResolvedValue(mockResult);

            const result = await controller.updateService(mockRequest, mockServiceId, mockDto);

            expect(serviceConfigsService.updateService).toHaveBeenCalledWith(mockClinicManagerId, mockServiceId, mockDto);
            expect(result).toEqual(mockResult);
        });
    });

    describe('toggleServiceStatus', () => {
        it('should call toggleServiceStatus with correct manager ID, service ID, and status', async () => {
            const mockServiceId = 'service-123';
            const mockDto: any = {
                isActive: false,
            };
            const mockResult = { _id: mockServiceId, isActive: false };
            serviceConfigsService.toggleServiceStatus.mockResolvedValue(mockResult);

            const result = await controller.toggleServiceStatus(mockRequest, mockServiceId, mockDto);

            expect(serviceConfigsService.toggleServiceStatus).toHaveBeenCalledWith(mockClinicManagerId, mockServiceId, mockDto.isActive);
            expect(result).toEqual(mockResult);
        });
    });
});
