/**
 * Shared constants for English clinic locations
 * Contains ONLY the 7 predefined real-world clinic addresses
 */

export interface ClinicLocation {
  address: string;
  ward: string;
  district: string;
  province: string;
  wardCode: string;
  districtCode: string;
  provinceCode: string;
  googleIframe: string;
  clinicName: string;
}

export const CLINIC_LOCATIONS: ClinicLocation[] = [
  {
    address: '135 Nam Ky Khoi Nghia, Ben Thanh Ward, District 1, Ho Chi Minh City',
    ward: 'Ben Thanh Ward',
    district: 'District 1',
    province: 'Ho Chi Minh City',
    wardCode: '26743',
    districtCode: '760',
    provinceCode: '79',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=135%20Nam%20K%E1%BB%B3%20Kh%E1%BB%9Fi%20Ngh%C4%A9a%2C%20Ph%C6%B0%E1%BB%9Dng%20B%E1%BA%BFn%20Th%C3%A0nh%2C%20Qu%E1%BA%ADn%201%2C%20H%E1%BB%93%20Ch%C3%AD%20Minh.&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Ho Chi Minh - D1',
  },
  {
    address: '534 Vinh Khanh, Ward 8, District 4, Ho Chi Minh City',
    ward: 'Ward 8',
    district: 'District 4',
    province: 'Ho Chi Minh City',
    wardCode: '27121',
    districtCode: '764',
    provinceCode: '79',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=534%20V%C4%A9nh%20Kh%C3%A1nh%2C%20Ph%C6%B0%E1%BB%9Dng%208%2C%20Qu%E1%BA%ADn%204%2C%20%2C%20H%E1%BB%93%20Ch%C3%AD%20Minh.&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Ho Chi Minh - D4',
  },
  {
    address: '58 Quoc Tu Giam, Dong Da District, Hanoi',
    ward: 'Quoc Tu Giam',
    district: 'Dong Da District',
    province: 'Hanoi',
    wardCode: '00056',
    districtCode: '105',
    provinceCode: '01',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=%2058%20Qu%E1%BB%91c%20T%E1%BB%AD%20Gi%C3%A1m%2C%20Qu%E1%BA%ADn%20%C4%90%E1%BB%91ng%20%C4%90a&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Hanoi - Dong Da',
  },
  {
    address: '10 Ly Quoc Su, Hoan Kiem District, Hanoi',
    ward: 'Ly Quoc Su',
    district: 'Hoan Kiem District',
    province: 'Hanoi',
    wardCode: '00045',
    districtCode: '104',
    provinceCode: '01',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=10%20L%C3%BD%20Qu%E1%BB%91c%20S%C6%B0%2C%20Qu%E1%BA%ADn%20Ho%C3%A0n%20Ki%E1%BA%BFm&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Hanoi - Hoan Kiem',
  },
  {
    address: '61 Hai Thang Tu, Vinh Phuoc Ward, Nha Trang',
    ward: 'Vinh Phuoc Ward',
    district: 'Nha Trang',
    province: 'Khanh Hoa',
    wardCode: '93158',
    districtCode: '931',
    provinceCode: '56',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=61%20Hai%20Th%C3%A1ng%20T%C6%B0%2C%20Ph%C6%B0%E1%BB%9Dng%20V%C4%A9nh%20Ph%C6%B0%E1%BB%9Cc&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Nha Trang',
  },
  {
    address: '81 Huyen Tran Cong Chua, Ngu Hanh Son District, Da Nang',
    ward: 'Ngu Hanh Son District',
    district: 'Da Nang',
    province: 'Da Nang',
    wardCode: '48201',
    districtCode: '488',
    provinceCode: '48',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=81%20Huy%E1%BB%81n%20Tr%C3%A2n%20C%C3%B4ng%20Ch%C3%BAa%2C%20Qu%E1%BA%ADn%20Ng%C5%A5%20H%C3%A0nh%20S%C6%A1n&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Da Nang',
  },
  {
    address: '46 Hai Ba Trung Street, Tan An Ward, Ninh Kieu District, Can Tho',
    ward: 'Tan An Ward',
    district: 'Ninh Kieu District',
    province: 'Can Tho',
    wardCode: '95018',
    districtCode: '956',
    provinceCode: '92',
    googleIframe:
      '<iframe class="embed-map-frame" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=600&height=400&hl=en&q=S%E1%BB%91%2046%20%C4%91%C6%B0%E1%BB%9Dng%20Hai%20B%C3%A0%20Tr%C6%B0ng%2C%20T%C3%A2n%20An&t=&z=14&ie=UTF8&iwloc=B&output=embed"></iframe>',
    clinicName: 'Bonix Can Tho',
  },
];

export const MANAGER_ADDRESS_MAPPING: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 0,
  8: 1,
  9: 2,
};

export function getClinicLocation(index: number): ClinicLocation {
  return CLINIC_LOCATIONS[index % CLINIC_LOCATIONS.length];
}