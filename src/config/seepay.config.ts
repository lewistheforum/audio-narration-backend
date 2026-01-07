import { registerAs } from '@nestjs/config';

export default registerAs('seepay', () => ({
  qrBase: process.env.SEEPAY_QR_BASE || 'https://qr.sepay.vn/img',
  account: process.env.SEEPAY_ACC,
  bank: process.env.SEEPAY_BANK,
  qrExpireMinutes: parseInt(process.env.SEEPAY_QR_EXPIRE_MINUTES || '15', 10),
  callbackSecret: process.env.SEEPAY_CALLBACK_SECRET,
}));