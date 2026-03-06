/**
 * Shared constants for English locations
 * Used across multiple seeders for consistent English location generation
 */

export const PROVINCES = [
  {
    code: 1,
    name: 'Thành phố Hà Nội',
    districts: [
      { code: 1, name: 'Quận Ba Đình' },
      { code: 5, name: 'Quận Cầu Giấy' },
      { code: 6, name: 'Quận Đống Đa' },
      { code: 7, name: 'Quận Hai Bà Trưng' },
      { code: 2, name: 'Quận Hoàn Kiếm' },
      { code: 3, name: 'Quận Tây Hồ' },
      { code: 8, name: 'Quận Hoàng Mai' },
      { code: 9, name: 'Quận Thanh Xuân' },
      { code: 4, name: 'Quận Long Biên' },
    ],
  },
  {
    code: 79,
    name: 'Thành phố Hồ Chí Minh',
    districts: [
      { code: 760, name: 'Quận 1' },
      { code: 770, name: 'Quận 3' },
      { code: 774, name: 'Quận 5' },
      { code: 775, name: 'Quận 6' },
      { code: 771, name: 'Quận 10' },
      { code: 772, name: 'Quận 11' },
      { code: 785, name: 'Quận 12' },
      { code: 778, name: 'Quận Bình Thạnh' },
      { code: 764, name: 'Quận Gò Vấp' },
      { code: 768, name: 'Quận Phú Nhuận' },
      { code: 766, name: 'Quận Tân Bình' },
      { code: 767, name: 'Quận Tân Phú' },
    ],
  },
  {
    code: 48,
    name: 'Thành phố Đà Nẵng',
    districts: [
      { code: 490, name: 'Quận Hải Châu' },
      { code: 491, name: 'Quận Thanh Khê' },
      { code: 492, name: 'Quận Sơn Trà' },
      { code: 493, name: 'Quận Ngũ Hành Sơn' },
      { code: 494, name: 'Quận Liên Chiểu' },
      { code: 495, name: 'Quận Cẩm Lệ' },
    ],
  },
  {
    code: 31,
    name: 'Thành phố Hải Phòng',
    districts: [
      { code: 303, name: 'Quận Hồng Bàng' },
      { code: 304, name: 'Quận Ngô Quyền' },
      { code: 305, name: 'Quận Lê Chân' },
      { code: 306, name: 'Quận Hải An' },
      { code: 307, name: 'Quận Kiến An' },
      { code: 308, name: 'Quận Đồ Sơn' },
    ],
  },
  {
    code: 92,
    name: 'Thành phố Cần Thơ',
    districts: [
      { code: 916, name: 'Quận Ninh Kiều' },
      { code: 917, name: 'Quận Bình Thuỷ' },
      { code: 918, name: 'Quận Cái Răng' },
      { code: 919, name: 'Quận Ô Môn' },
      { code: 923, name: 'Quận Thốt Nốt' },
    ],
  },
];

export const WARDS_D1_HCMC = [
  { code: 26734, name: 'Phường Tân Định', parent_code: 760 },
  { code: 26737, name: 'Phường Đa Kao', parent_code: 760 },
  { code: 26740, name: 'Phường Bến Nghé', parent_code: 760 },
  { code: 26743, name: 'Phường Bến Thành', parent_code: 760 },
  { code: 26746, name: 'Phường Nguyễn Thái Bình', parent_code: 760 },
  { code: 26749, name: 'Phường Phạm Ngũ Lão', parent_code: 760 },
  { code: 26752, name: 'Phường Cầu Ông Lãnh', parent_code: 760 },
  { code: 26755, name: 'Phường Cô Giang', parent_code: 760 },
  { code: 26758, name: 'Phường Nguyễn Cư Trinh', parent_code: 760 },
  { code: 26761, name: 'Phường Cầu Kho', parent_code: 760 },
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
