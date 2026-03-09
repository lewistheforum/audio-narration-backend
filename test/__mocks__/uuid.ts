// Manual mock for uuid module to handle ESM compatibility in Jest
export const v4 = jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(7));
export const v1 = jest.fn(() => 'test-uuid-v1-' + Math.random().toString(36).substring(7));
export const v3 = jest.fn();
export const v5 = jest.fn();
export const NIL = '00000000-0000-0000-0000-000000000000';
export const parse = jest.fn();
export const stringify = jest.fn();
export const validate = jest.fn(() => true);
export const version = jest.fn();
