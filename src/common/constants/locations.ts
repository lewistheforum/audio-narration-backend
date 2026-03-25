/**
 * Shared constants for English locations
 * Used across multiple seeders for consistent English location generation
 */

export const PROVINCES = [
  {
    code: 1,
    name: 'Hanoi',
    districts: [
      { code: 1, name: 'Ba Dinh District' },
      { code: 5, name: 'Cau Giay District' },
      { code: 6, name: 'Dong Da District' },
      { code: 7, name: 'Hai Ba Trung District' },
      { code: 2, name: 'Hoan Kiem District' },
      { code: 3, name: 'Tay Ho District' },
      { code: 8, name: 'Hoang Mai District' },
      { code: 9, name: 'Thanh Xuan District' },
      { code: 4, name: 'Long Bien District' },
    ],
  },
  {
    code: 79,
    name: 'Ho Chi Minh City',
    districts: [
      { code: 760, name: 'District 1' },
      { code: 770, name: 'District 3' },
      { code: 774, name: 'District 5' },
      { code: 775, name: 'District 6' },
      { code: 771, name: 'District 10' },
      { code: 772, name: 'District 11' },
      { code: 785, name: 'District 12' },
      { code: 778, name: 'Binh Thanh District' },
      { code: 764, name: 'Go Vap District' },
      { code: 768, name: 'Phu Nhuan District' },
      { code: 766, name: 'Tan Binh District' },
      { code: 767, name: 'Tan Phu District' },
    ],
  },
  {
    code: 48,
    name: 'Da Nang City',
    districts: [
      { code: 490, name: 'Hai Chau District' },
      { code: 491, name: 'Thanh Khe District' },
      { code: 492, name: 'Son Tra District' },
      { code: 493, name: 'Ngu Hanh Son District' },
      { code: 494, name: 'Lien Chieu District' },
      { code: 495, name: 'Cam Le District' },
    ],
  },
  {
    code: 31,
    name: 'Hai Phong City',
    districts: [
      { code: 303, name: 'Hong Bang District' },
      { code: 304, name: 'Ngo Quyen District' },
      { code: 305, name: 'Le Chan District' },
      { code: 306, name: 'Hai An District' },
      { code: 307, name: 'Kien An District' },
      { code: 308, name: 'Do Son District' },
    ],
  },
  {
    code: 92,
    name: 'Can Tho City',
    districts: [
      { code: 916, name: 'Ninh Kieu District' },
      { code: 917, name: 'Binh Thuy District' },
      { code: 918, name: 'Cai Rang District' },
      { code: 919, name: 'O Mon District' },
      { code: 923, name: 'Thot Not District' },
    ],
  },
];

export const WARDS_D1_HCMC = [
  { code: 26734, name: 'Tan Dinh Ward', parent_code: 760 },
  { code: 26737, name: 'Da Kao Ward', parent_code: 760 },
  { code: 26740, name: 'Ben Nghe Ward', parent_code: 760 },
  { code: 26743, name: 'Ben Thanh Ward', parent_code: 760 },
  { code: 26746, name: 'Nguyen Thai Binh Ward', parent_code: 760 },
  { code: 26749, name: 'Pham Ngu Lao Ward', parent_code: 760 },
  { code: 26752, name: 'Cau Ong Lanh Ward', parent_code: 760 },
  { code: 26755, name: 'Co Giang Ward', parent_code: 760 },
  { code: 26758, name: 'Nguyen Cu Trinh Ward', parent_code: 760 },
  { code: 26761, name: 'Cau Kho Ward', parent_code: 760 },
];

export const STREET_NAMES = [
  'Nguyen Van Linh Street',
  'Le Van Luong Street',
  'Nguyen Thi Dinh Street',
  'Pham Van Dong Street',
  'Huynh Tan Phat Street',
  'Le Duc Tho Street',
  'Dien Bien Phu Street',
  'Nguyen Van Troi Street',
  'Hoang Van Thu Street',
  'Ly Thuong Kiet Street',
  'Le Duan Street',
  'Nguyen Binh Khiem Street',
  'Pham Ngoc Thach Street',
  'Vo Van Tan Street',
  'Dang Thuy Tram Street',
  'Ung Van Khiem Street',
];

export const BUILDING_TYPES = ['Floor', 'Level', 'No.'];

export const BRANCH_NAMES = [
  'District 1 Branch',
  'District 3 Branch',
  'District 5 Branch',
  'District 7 Branch',
  'District 10 Branch',
  'Tan Binh District Branch',
  'Binh Thanh District Branch',
  'Go Vap District Branch',
  'Phu Nhuan District Branch',
  'Thu Duc District Branch',
  'Ba Dinh District Branch',
  'Hoan Kiem District Branch',
  'Hai Ba Trung District Branch',
  'Dong Da District Branch',
  'Cau Giay District Branch',
];

export const HEADER_ADDRESSES = [
  'Floor 5, Sunrise Building, Nguyen Van Linh Street, District 7, Ho Chi Minh City',
  'Floor 3, Vincom Building, Le Duan Street, District 1, Ho Chi Minh City',
  'No. 123, Dien Bien Phu Street, Ba Dinh District, Hanoi City',
  'Floor 2, Techcombank Building, Nguyen Van Troi Street, Cau Giay District, Hanoi City',
  'No. 456, Vo Van Tan Street, Tan Binh District, Ho Chi Minh City',
];
