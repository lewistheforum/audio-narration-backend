import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

const HAS_TIMEZONE_REGEX = /(Z|[+-]\d{2}:\d{2})$/i;

function toVietnamDayjs(date?: Date | string | number): dayjs.Dayjs {
  if (date === undefined || date === null) {
    return dayjs().tz(VIETNAM_TIMEZONE);
  }

  if (typeof date === 'string') {
    const normalizedDate = date.trim();

    if (HAS_TIMEZONE_REGEX.test(normalizedDate)) {
      return dayjs(normalizedDate).tz(VIETNAM_TIMEZONE);
    }

    return dayjs.tz(normalizedDate, VIETNAM_TIMEZONE);
  }

  return dayjs(date).tz(VIETNAM_TIMEZONE);
}

const inputStr = '2026-04-10T17:00:00.000Z';
console.log('Original parsing:', toVietnamDayjs(inputStr).format());

const strippedStr = inputStr.replace(/(Z|[+-]\d{2}:\d{2})$/i, '');
console.log('Stripped string:', strippedStr);
console.log('Stripped parsing:', toVietnamDayjs(strippedStr).format());
