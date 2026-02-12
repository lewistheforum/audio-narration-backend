
import { DataSource } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../../app.module';
import { ClinicSubscriptionHistory } from '../../../../../modules/subscriptions/entities/clinic-subscription-history.entity';
import { Account } from '../../../../../modules/accounts/entities/accounts.entity';
import { SubscriptionService } from '../../../../../modules/subscriptions/entities/subscription-service.entity';
import { AccountRole } from '../../../../../modules/accounts/enums/account-role.enum';
import { RegistrationStatus } from '../../../../../modules/subscriptions/enums/subscription-status.enum';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    const historyRepo = dataSource.getRepository(ClinicSubscriptionHistory);
    const accountRepo = dataSource.getRepository(Account);
    const serviceRepo = dataSource.getRepository(SubscriptionService);

    console.log('🌱 Seeding Clinic Subscription History...');

    // 1. Get Clinics (CLINIC_ADMIN only)
    const clinics = await accountRepo.find({
        where: { role: AccountRole.CLINIC_ADMIN }
    });

    if (clinics.length === 0) {
        console.warn('⚠️ No CLINIC_ADMIN accounts found. Please seed accounts first.');
        await app.close();
        return;
    }

    // 2. Get Subscription Services
    const services = await serviceRepo.find();
    if (services.length === 0) {
        console.warn('⚠️ No subscription services found. Please seed services first.');
        await app.close();
        return;
    }

    console.log(`ℹ️ Found ${clinics.length} clinics and ${services.length} services.`);

    let createdCount = 0;

    for (const clinic of clinics) {
        // Randomly assign 1-3 history records per clinic
        const numberOfRecords = Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < numberOfRecords; i++) {
            const randomService = services[Math.floor(Math.random() * services.length)];

            // Generate some random statuses
            const statuses = [
                RegistrationStatus.ACTIVE,
                RegistrationStatus.EXPIRED,
                RegistrationStatus.PENDING_PAYMENT,
                RegistrationStatus.QUEUED_FOR_RENEWAL
            ];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

            // Create history record
            const history = historyRepo.create({
                clinicId: clinic._id,
                serviceId: randomService._id,
                subscriptionStatus: randomStatus,
                subscriptionDate: new Date(),
                expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // +1 year
            });

            await historyRepo.save(history);
            console.log(`✅ Added History: Clinic ${clinic.email} -> Service ${randomService.serviceName} [${randomStatus}]`);
            createdCount++;
        }
    }

    console.log(`🎉 Finished! Created ${createdCount} subscription history records.`);

    await app.close();
}

bootstrap();
