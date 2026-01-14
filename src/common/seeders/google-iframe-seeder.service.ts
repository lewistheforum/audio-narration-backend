import { Injectable, Logger } from '@nestjs/common';
import { Address } from '../../modules/accounts/entities/addresses.entity';
import { GoogleIframe } from '../../modules/accounts/entities/google_iframe.entity';
import { GoogleIframeRepository } from '../../modules/accounts/repositories/google-iframe.repository';
import { AddressRepository } from '../../modules/accounts/repositories/address.repository';

/**
 * GoogleIframe Seeder Service
 *
 * Seeds Google Map iframe records for addresses of CLINIC_MANAGER accounts.
 *
 * Seeding Rules:
 * - For each Address belonging to CLINIC_MANAGER accounts, create 1 GoogleIframe record.
 * - Must be idempotent (re-run safe).
 * - Seed plausible Google Maps embed URL/iframe placeholder aligned with system context.
 *
 * Idempotent: Uses check-then-insert pattern by addressId
 */
@Injectable()
export class GoogleIframeSeederService {
  private readonly logger = new Logger(GoogleIframeSeederService.name);

  // Google Maps iframe templates for orthopedics clinics
  private readonly MAP_STYLES = [
    'standard',
    'satellite',
    'hybrid',
    'terrain',
  ];

  private readonly ZOOM_LEVELS = [14, 15, 16, 17, 18];

  private readonly MAP_HEIGHTS = [300, 350, 400, 450, 500];

  private readonly MAP_WIDTHS = [400, 500, 600, 700, 800];

  // Sample Google Maps embed URLs for major Vietnamese cities
  private readonly MAP_IFRAME_TEMPLATES = [
    {
      city: 'Hà Nội',
      center: '21.0285,105.8542',
      placeholder: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d105.8542!2d21.0285!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sHa+Noi!5e0!3m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Hồ Chí Minh',
      center: '10.8231,106.6297',
      placeholder: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d106.6297!2d10.8231!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Đà Nẵng',
      center: '16.0544,108.2022',
      placeholder: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d108.2022!2d16.0544!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Hải Phòng',
      center: '20.8449,106.6881',
      placeholder: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d106.6881!2d20.8449!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
    {
      city: 'Cần Thơ',
      center: '10.0452,105.7469',
      placeholder: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d105.7469!2d10.0452!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1svi!2svi!4s2023-01-01" width="600" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>',
    },
  ];

  constructor(
    private readonly googleIframeRepository: GoogleIframeRepository,
    private readonly addressRepository: AddressRepository,
  ) {}

  /**
   * Seed Google iframe records for all addresses
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed Google iframe records...');

      // Get all addresses (they belong to CLINIC_MANAGER accounts)
      const addresses = await this.addressRepository.findAll();

      if (addresses.length === 0) {
        this.logger.warn('No addresses found. Skipping seeding.');
        return;
      }

      let createdCount = 0;
      let skippedCount = 0;

      for (const address of addresses) {
        // Check if Google iframe already exists for this address
        const existing =
          await this.googleIframeRepository.existsByAddressId(address._id);

        if (existing) {
          skippedCount++;
          continue;
        }

        // Determine city from address province name for appropriate map
        const mapTemplate = this.getMapTemplateForAddress(address);

        // Create Google iframe with realistic data
        const googleIframe = this.googleIframeRepository.create({
          addressId: address._id,
          location: mapTemplate.center,
          mapStyle: this.getRandomMapStyle(),
          zoomLevel: this.getRandomZoomLevel(),
          mapHeight: this.getRandomMapHeight(),
          mapWidth: this.getRandomMapWidth(),
          responsive: true,
          googleMapIframe: mapTemplate.placeholder,
        });

        await this.googleIframeRepository.save(googleIframe);
        createdCount++;
      }

      this.logger.log(
        `✅ GoogleIframe seeding completed: ${createdCount} created, ${skippedCount} skipped`,
      );
    } catch (error) {
      this.logger.error('Failed to seed Google iframe records', error.stack);
      throw error;
    }
  }

  /**
   * Get map template based on address province name
   */
  private getMapTemplateForAddress(address: Address): {
    city: string;
    center: string;
    placeholder: string;
  } {
    const provinceName = address.provinceName.toLowerCase();

    // Try to match city from province name
    if (provinceName.includes('hà nội') || provinceName.includes('thành phố hà nội')) {
      return this.MAP_IFRAME_TEMPLATES[0];
    }
    if (
      provinceName.includes('hồ chí minh') ||
      provinceName.includes('thành phố hồ chí minh')
    ) {
      return this.MAP_IFRAME_TEMPLATES[1];
    }
    if (provinceName.includes('đà nẵng') || provinceName.includes('thành phố đà nẵng')) {
      return this.MAP_IFRAME_TEMPLATES[2];
    }
    if (provinceName.includes('hải phòng') || provinceName.includes('thành phố hải phòng')) {
      return this.MAP_IFRAME_TEMPLATES[3];
    }
    if (provinceName.includes('cần thơ') || provinceName.includes('thành phố cần thơ')) {
      return this.MAP_IFRAME_TEMPLATES[4];
    }

    // Default to Hanoi if no match
    return this.MAP_IFRAME_TEMPLATES[0];
  }

  /**
   * Get random map style
   */
  private getRandomMapStyle(): string {
    return this.MAP_STYLES[Math.floor(Math.random() * this.MAP_STYLES.length)];
  }

  /**
   * Get random zoom level
   */
  private getRandomZoomLevel(): number {
    return this.ZOOM_LEVELS[Math.floor(Math.random() * this.ZOOM_LEVELS.length)];
  }

  /**
   * Get random map height
   */
  private getRandomMapHeight(): number {
    return this.MAP_HEIGHTS[Math.floor(Math.random() * this.MAP_HEIGHTS.length)];
  }

  /**
   * Get random map width
   */
  private getRandomMapWidth(): number {
    return this.MAP_WIDTHS[Math.floor(Math.random() * this.MAP_WIDTHS.length)];
  }
}
