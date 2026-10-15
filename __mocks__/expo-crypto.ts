// Mock for expo-crypto in Jest environment
declare const require: any;
const nodeCrypto = require('crypto');

export const CryptoDigestAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD2: 'MD2',
  MD4: 'MD4',
  MD5: 'MD5',
};

export const CryptoEncoding = {
  HEX: 'HEX',
  BASE64: 'BASE64',
};

export function randomUUID(): string {
  if (nodeCrypto && typeof nodeCrypto.randomUUID === 'function') {
    return nodeCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function digestStringAsync(
  algorithm: string,
  str: string,
  _options?: any
): Promise<string> {
  const normAlgo = algorithm.toLowerCase().replace(/[^a-z0-9]/g, '');
  const algo = normAlgo.includes('sha256') ? 'sha256' : normAlgo.includes('sha512') ? 'sha512' : 'sha256';
  return nodeCrypto.createHash(algo).update(str, 'utf8').digest('hex');
}
