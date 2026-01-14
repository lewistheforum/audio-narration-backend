import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface Ward {
  name: string;
  code: number;
  codename: string;
  division_type: string;
  short_codename: string;
}

interface District {
  name: string;
  code: number;
  codename: string;
  division_type: string;
  short_codename: string;
  wards: Ward[];
}

interface Province {
  name: string;
  code: number;
  codename: string;
  division_type: string;
  phone_code: number;
  districts: District[];
}

export interface AddressData {
  provinceCode: number;
  provinceName: string;
  districtCode: number;
  districtName: string;
  wardCode: number;
  wardName: string;
}

/**
 * Address Data Service
 *
 * Fetches and manages Vietnamese address data from external API
 * Provides helper methods to get random or specific addresses
 */
@Injectable()
export class AddressDataService {
  private readonly logger = new Logger(AddressDataService.name);
  private readonly API_URL = 'https://provinces.open-api.vn/api/?depth=3';
  private provinces: Province[] = [];
  private dataFetched = false;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetch address data from API and cache it
   */
  async fetchAddressData(): Promise<void> {
    if (this.dataFetched) {
      return;
    }

    try {
      this.logger.log('Fetching Vietnamese address data from API...');
      const response = await firstValueFrom(
        this.httpService.get<Province[]>(this.API_URL),
      );
      this.provinces = response.data;
      this.dataFetched = true;
      this.logger.log(
        `✅ Address data fetched successfully: ${this.provinces.length} provinces`,
      );
    } catch (error) {
      this.logger.error('Failed to fetch address data from API', error.message);
      // Set empty array to prevent repeated API calls
      this.provinces = [];
      this.dataFetched = true;
    }
  }

  /**
   * Get a random address (province/district/ward combination)
   */
  async getRandomAddress(): Promise<AddressData | null> {
    await this.fetchAddressData();

    if (this.provinces.length === 0) {
      return null;
    }

    // Get random province
    const province =
      this.provinces[Math.floor(Math.random() * this.provinces.length)];

    if (!province.districts || province.districts.length === 0) {
      return null;
    }

    // Get random district
    const district =
      province.districts[Math.floor(Math.random() * province.districts.length)];

    if (!district.wards || district.wards.length === 0) {
      return null;
    }

    // Get random ward
    const ward =
      district.wards[Math.floor(Math.random() * district.wards.length)];

    return {
      provinceCode: province.code,
      provinceName: province.name,
      districtCode: district.code,
      districtName: district.name,
      wardCode: ward.code,
      wardName: ward.name,
    };
  }

  /**
   * Get address by province code
   */
  async getAddressByProvince(
    provinceCode: number,
  ): Promise<AddressData | null> {
    await this.fetchAddressData();

    const province = this.provinces.find((p) => p.code === provinceCode);

    if (!province || !province.districts || province.districts.length === 0) {
      return this.getRandomAddress();
    }

    // Get random district from the province
    const district =
      province.districts[Math.floor(Math.random() * province.districts.length)];

    if (!district.wards || district.wards.length === 0) {
      return this.getRandomAddress();
    }

    // Get random ward from the district
    const ward =
      district.wards[Math.floor(Math.random() * district.wards.length)];

    return {
      provinceCode: province.code,
      provinceName: province.name,
      districtCode: district.code,
      districtName: district.name,
      wardCode: ward.code,
      wardName: ward.name,
    };
  }

  /**
   * Get address by province and district code
   */
  async getAddressByDistrict(
    provinceCode: number,
    districtCode: number,
  ): Promise<AddressData | null> {
    await this.fetchAddressData();

    const province = this.provinces.find((p) => p.code === provinceCode);

    if (!province || !province.districts) {
      return this.getRandomAddress();
    }

    const district = province.districts.find((d) => d.code === districtCode);

    if (!district || !district.wards || district.wards.length === 0) {
      return this.getAddressByProvince(provinceCode);
    }

    // Get random ward from the district
    const ward =
      district.wards[Math.floor(Math.random() * district.wards.length)];

    return {
      provinceCode: province.code,
      provinceName: province.name,
      districtCode: district.code,
      districtName: district.name,
      wardCode: ward.code,
      wardName: ward.name,
    };
  }

  /**
   * Get Ho Chi Minh City address (most common for clinic locations)
   */
  async getHoChiMinhCityAddress(): Promise<AddressData | null> {
    // Ho Chi Minh City code is 79
    return this.getAddressByProvince(79);
  }
}
