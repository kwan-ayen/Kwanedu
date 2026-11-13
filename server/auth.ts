import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}:${salt}:${hash}`;
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${HASH_PREFIX}:`);
}

export function verifyPassword(password: string, stored: string): boolean {
  const [prefix, salt, expectedHex] = stored.split(':');
  if (prefix !== HASH_PREFIX || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
