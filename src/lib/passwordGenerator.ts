/**
 * Secure password generator utility
 * Uses crypto.getRandomValues() for secure randomness
 */

export interface PasswordGeneratorOptions {
  length?: number;
  includeSpecialChars?: boolean;
  includeNumbers?: boolean;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
}

const DEFAULT_OPTIONS: Required<PasswordGeneratorOptions> = {
  length: 16,
  includeSpecialChars: true,
  includeNumbers: true,
  includeUppercase: true,
  includeLowercase: true,
};

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Generates a secure random password
 */
export function generatePassword(options: PasswordGeneratorOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Ensure at least one character set is included
  if (!opts.includeLowercase && !opts.includeUppercase && !opts.includeNumbers && !opts.includeSpecialChars) {
    opts.includeLowercase = true;
  }

  // Build character set based on options
  let charSet = '';
  if (opts.includeLowercase) charSet += LOWERCASE;
  if (opts.includeUppercase) charSet += UPPERCASE;
  if (opts.includeNumbers) charSet += NUMBERS;
  if (opts.includeSpecialChars) charSet += SPECIAL;

  // Ensure minimum length
  const length = Math.max(8, Math.min(64, opts.length || 16));

  // Generate password using crypto API
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += charSet[array[i] % charSet.length];
  }

  // Ensure at least one character from each selected set is included
  if (opts.includeLowercase && !/[a-z]/.test(password)) {
    const randomIndex = Math.floor(Math.random() * password.length);
    password = password.slice(0, randomIndex) + LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)] + password.slice(randomIndex + 1);
  }
  if (opts.includeUppercase && !/[A-Z]/.test(password)) {
    const randomIndex = Math.floor(Math.random() * password.length);
    password = password.slice(0, randomIndex) + UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)] + password.slice(randomIndex + 1);
  }
  if (opts.includeNumbers && !/[0-9]/.test(password)) {
    const randomIndex = Math.floor(Math.random() * password.length);
    password = password.slice(0, randomIndex) + NUMBERS[Math.floor(Math.random() * NUMBERS.length)] + password.slice(randomIndex + 1);
  }
  if (opts.includeSpecialChars && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    const randomIndex = Math.floor(Math.random() * password.length);
    password = password.slice(0, randomIndex) + SPECIAL[Math.floor(Math.random() * SPECIAL.length)] + password.slice(randomIndex + 1);
  }

  return password;
}
