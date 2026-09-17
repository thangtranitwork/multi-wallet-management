/**
 * Pure TypeScript QR Code Generator (ISO/IEC 18004)
 * Based on Project Nayuki's QR Code generator library (MIT / Public Domain)
 * Zero dependencies, works seamlessly in React Native, Web, and Node.js.
 */

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

// Reed-Solomon Galois Field GF(256) constants and utilities
const GF256_EXP: number[] = new Array(512);
const GF256_LOG: number[] = new Array(256);
(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = val;
    GF256_EXP[i + 255] = val;
    GF256_LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  GF256_LOG[0] = 0;
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function reedSolomonComputeDivisor(degree: number): number[] {
  let result: number[] = [1];
  for (let i = 0; i < degree; i++) {
    const next: number[] = new Array(result.length + 1).fill(0);
    const root = GF256_EXP[i];
    for (let j = 0; j < result.length; j++) {
      next[j] ^= gfMultiply(result[j], root);
      next[j + 1] ^= result[j];
    }
    result = next;
  }
  return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length - 1).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < result.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

// Table of error correction codewords and blocks per version (Versions 1 to 10 are enough for up to 271 bytes in L/M)
// Format: [ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
const ECC_TABLE: Record<ErrorCorrectionLevel, number[][]> = {
  L: [
    [],
    [7, 1, 19, 0, 0],    // V1
    [10, 1, 34, 0, 0],   // V2
    [15, 1, 55, 0, 0],   // V3
    [20, 1, 80, 0, 0],   // V4
    [26, 1, 108, 0, 0],  // V5
    [18, 2, 68, 0, 0],   // V6
    [20, 2, 78, 0, 0],   // V7
    [24, 2, 97, 0, 0],   // V8
    [30, 2, 116, 0, 0],  // V9
    [18, 2, 68, 2, 69],  // V10
  ],
  M: [
    [],
    [10, 1, 16, 0, 0],   // V1
    [16, 1, 28, 0, 0],   // V2
    [26, 1, 44, 0, 0],   // V3
    [18, 2, 32, 0, 0],   // V4
    [24, 2, 43, 0, 0],   // V5
    [16, 4, 27, 0, 0],   // V6
    [18, 4, 31, 0, 0],   // V7
    [22, 2, 38, 2, 39],  // V8
    [22, 3, 36, 2, 37],  // V9
    [26, 4, 43, 1, 44],  // V10
  ],
  Q: [
    [],
    [13, 1, 13, 0, 0],
    [22, 1, 22, 0, 0],
    [18, 2, 17, 0, 0],
    [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0],
    [18, 2, 14, 4, 15],
    [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17],
    [24, 6, 19, 2, 20],
  ],
  H: [
    [],
    [17, 1, 9, 0, 0],
    [28, 1, 16, 0, 0],
    [22, 2, 13, 0, 0],
    [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0],
    [26, 4, 13, 1, 14],
    [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13],
    [28, 6, 15, 2, 16],
  ],
};

const ALIGNMENT_PATTERN_POSITIONS: number[][] = [
  [],
  [], // V1
  [6, 18], // V2
  [6, 22], // V3
  [6, 26], // V4
  [6, 30], // V5
  [6, 34], // V6
  [6, 22, 38], // V7
  [6, 24, 42], // V8
  [6, 26, 46], // V9
  [6, 28, 50], // V10
];

class BitBuffer {
  private buffer: number[] = [];
  private length: number = 0;

  public getLength(): number {
    return this.length;
  }

  public getBuffer(): number[] {
    return this.buffer;
  }

  public put(val: number, bitLength: number): void {
    for (let i = 0; i < bitLength; i++) {
      this.putBit(((val >>> (bitLength - i - 1)) & 1) === 1);
    }
  }

  public putBit(bit: boolean): void {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }
}

export class QRCodeMatrix {
  public readonly version: number;
  public readonly size: number;
  public readonly modules: boolean[][];
  private readonly isFunctionModule: boolean[][];

  constructor(version: number) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunctionModule = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }

  public setFunction(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark;
    this.isFunctionModule[y][x] = true;
  }

  public isFunction(x: number, y: number): boolean {
    return this.isFunctionModule[y][x];
  }
}

/**
 * Generate a 2D boolean matrix for a given text string
 */
export function generateQRCodeMatrix(
  text: string,
  ecl: ErrorCorrectionLevel = 'M'
): boolean[][] {
  // 1. Encode text as UTF-8 bytes
  const textBytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 128) {
      textBytes.push(code);
    } else if (code < 2048) {
      textBytes.push((code >> 6) | 192);
      textBytes.push((code & 63) | 128);
    } else {
      textBytes.push((code >> 12) | 224);
      textBytes.push(((code >> 6) & 63) | 128);
      textBytes.push((code & 63) | 128);
    }
  }

  // 2. Select minimal QR Code version
  let version = 1;
  let eccEntry: number[] | null = null;
  let totalDataCodewords = 0;

  for (let v = 1; v <= 10; v++) {
    const entry = ECC_TABLE[ecl][v];
    const capacity = entry[1] * entry[2] + entry[3] * entry[4];
    // Byte mode header: 4 bits mode + 8/16 bits character count
    const charCountBits = v < 10 ? 8 : 16;
    const requiredBits = 4 + charCountBits + textBytes.length * 8;
    if (requiredBits <= capacity * 8) {
      version = v;
      eccEntry = entry;
      totalDataCodewords = capacity;
      break;
    }
  }

  if (!eccEntry) {
    throw new Error('Payload too large for supported QR Code versions (max 10)');
  }

  // 3. Build data bit stream (Byte mode)
  const bitBuffer = new BitBuffer();
  // Mode indicator: 0100 (Byte mode)
  bitBuffer.put(0x4, 4);
  // Character count
  const charCountBits = version < 10 ? 8 : 16;
  bitBuffer.put(textBytes.length, charCountBits);
  // Data bytes
  for (const b of textBytes) {
    bitBuffer.put(b, 8);
  }

  // Terminator (up to 4 zeroes)
  const totalDataBits = totalDataCodewords * 8;
  const paddingZeroes = Math.min(4, totalDataBits - bitBuffer.getLength());
  bitBuffer.put(0, paddingZeroes);

  // Pad to multiple of 8 bits
  while (bitBuffer.getLength() % 8 !== 0) {
    bitBuffer.putBit(false);
  }

  // Pad bytes 0xEC and 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuffer.getLength() < totalDataBits) {
    bitBuffer.put(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // 4. Interleave data and error correction blocks
  const dataCodewords = bitBuffer.getBuffer();
  const [ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2] = eccEntry;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  const divisor = reedSolomonComputeDivisor(ecCodewordsPerBlock);

  let dataOffset = 0;
  const totalBlocks = numBlocksGroup1 + numBlocksGroup2;

  for (let b = 0; b < totalBlocks; b++) {
    const isGroup1 = b < numBlocksGroup1;
    const blockSize = isGroup1 ? dataCodewordsGroup1 : dataCodewordsGroup2;
    const blockData = dataCodewords.slice(dataOffset, dataOffset + blockSize);
    dataOffset += blockSize;

    const remainder = reedSolomonComputeRemainder(blockData, divisor);
    dataBlocks.push(blockData);
    ecBlocks.push(remainder);
  }

  // Interleave final codewords
  const finalCodewords: number[] = [];
  const maxDataCodewords = Math.max(dataCodewordsGroup1, dataCodewordsGroup2 || 0);

  for (let i = 0; i < maxDataCodewords; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
  }

  for (let i = 0; i < ecCodewordsPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // 5. Build QR Matrix & layout function patterns
  const qr = new QRCodeMatrix(version);
  const size = qr.size;

  // 5.1 Finder patterns (Top-Left, Top-Right, Bottom-Left)
  drawFinderPattern(qr, 0, 0);
  drawFinderPattern(qr, size - 7, 0);
  drawFinderPattern(qr, 0, size - 7);

  // 5.2 Alignment patterns
  const alignCoords = ALIGNMENT_PATTERN_POSITIONS[version];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const cx = alignCoords[i];
      const cy = alignCoords[j];
      if (
        (cx === 6 && cy === 6) ||
        (cx === 6 && cy === size - 7) ||
        (cx === size - 7 && cy === 6)
      ) {
        continue;
      }
      drawAlignmentPattern(qr, cx, cy);
    }
  }

  // 5.3 Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (!qr.isFunction(i, 6)) qr.setFunction(i, 6, dark);
    if (!qr.isFunction(6, i)) qr.setFunction(6, i, dark);
  }

  // 5.4 Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (!qr.isFunction(i, 8)) qr.setFunction(i, 8, false);
    if (!qr.isFunction(8, i)) qr.setFunction(8, i, false);
    if (!qr.isFunction(size - 1 - i, 8)) qr.setFunction(size - 1 - i, 8, false);
    if (!qr.isFunction(8, size - 1 - i)) qr.setFunction(8, size - 1 - i, false);
  }
  // Dark module
  qr.setFunction(8, size - 8, true);

  // 6. Write data bits with zigzag scanning
  let codewordIndex = 0;
  let bitIndex = 7;
  let goingUp = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column

    for (let vert = 0; vert < size; vert++) {
      const y = goingUp ? size - 1 - vert : vert;

      for (let x = right; x >= right - 1; x--) {
        if (qr.isFunction(x, y)) continue;

        let bit = false;
        if (codewordIndex < finalCodewords.length) {
          bit = ((finalCodewords[codewordIndex] >>> bitIndex) & 1) === 1;
          bitIndex--;
          if (bitIndex < 0) {
            codewordIndex++;
            bitIndex = 7;
          }
        }
        qr.modules[y][x] = bit;
      }
    }
    goingUp = !goingUp;
  }

  // 7. Choose mask pattern (Evaluate penalty scores for masks 0-7, pick best)
  let bestMask = 0;
  let minPenalty = Infinity;
  let bestModules: boolean[][] = qr.modules;

  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(qr, mask);
    drawFormatInfo(masked, size, ecl, mask);
    const penalty = calculatePenalty(masked, size);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
      bestModules = masked;
    }
  }

  return bestModules;
}

function drawFinderPattern(qr: QRCodeMatrix, startX: number, startY: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = startX + dx;
      const y = startY + dy;
      if (x < 0 || x >= qr.size || y < 0 || y >= qr.size) continue;
      const isFinder =
        dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      qr.setFunction(x, y, isFinder);
    }
  }
}

function drawAlignmentPattern(qr: QRCodeMatrix, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const isDark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
      qr.setFunction(cx + dx, cy + dy, isDark);
    }
  }
}

function applyMask(qr: QRCodeMatrix, mask: number): boolean[][] {
  const size = qr.size;
  const result: boolean[][] = qr.modules.map(row => [...row]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.isFunction(x, y)) continue;

      let invert = false;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; break;
        case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      }
      if (invert) {
        result[y][x] = !result[y][x];
      }
    }
  }
  return result;
}

const FORMAT_INFO_LOOKUP: Record<ErrorCorrectionLevel, number[]> = {
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
};

function drawFormatInfo(modules: boolean[][], size: number, ecl: ErrorCorrectionLevel, mask: number): void {
  const formatBits = FORMAT_INFO_LOOKUP[ecl][mask];

  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> i) & 1) === 1;

    // First copy: top-left around timing patterns
    if (i < 6) {
      modules[i][8] = bit;
    } else if (i < 8) {
      modules[i + 1][8] = bit;
    } else {
      modules[8][15 - i] = bit;
    }

    // Second copy: bottom-left & top-right
    if (i < 7) {
      modules[8][size - 1 - i] = bit;
    } else {
      modules[size - 15 + i][8] = bit;
    }
  }
}

function calculatePenalty(modules: boolean[][], size: number): number {
  let penalty = 0;

  // Rule 1: 5+ consecutive same color modules
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runLen = 0;
    for (let x = 0; x < size; x++) {
      if (x === 0 || modules[y][x] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[y][x];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runLen = 0;
    for (let y = 0; y < size; y++) {
      if (y === 0 || modules[y][x] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[y][x];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same color
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = modules[y][x];
      if (
        color === modules[y][x + 1] &&
        color === modules[y + 1][x] &&
        color === modules[y + 1][x + 1]
      ) {
        penalty += 3;
      }
    }
  }

  return penalty;
}
