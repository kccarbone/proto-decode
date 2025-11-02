export type BinaryNumber = {
  value: number;
  chunk: Uint8Array<ArrayBuffer>;
}


/** Convert bytes to number (fixed size) */
function fixedInt(input: Uint8Array<ArrayBuffer>, size: number): BinaryNumber {
  let value = 0;

  // Take a fixed chunk
  const chunk = input.slice(0, size);

  // Little-endian encoding, stack right to left!
  for (let i = chunk.length - 1; i >= 0; i--) {
    value = ((value << 8) | chunk[i]);
  }
  
  return { value, chunk };
}

/** Convert bytes to number (variable size) */
function varInt(input: Uint8Array<ArrayBuffer>): BinaryNumber {
  // Example: Input bytes: [ 0x92, 0x01 ]
  // Math: ((0x92 & 0x7f) | (0x01 << 7)).toString(10)
  // Result: 146 (in base 10)
  let value = 0;

  // Size is determined by finding the first byte that has MSB==0
  const size = input.findIndex(x => x < 0x80) + 1;

  // Take the entire chunk (can be up to 10 bytes)
  const chunk = input.slice(0, size);

  // Full number is stored in last 7 bits of each byte
  // Little-endian encoding, stack right to left!
  for (let i = chunk.length - 1; i >= 0; i--) {
    value = ((value << 7) | (chunk[i] & 0x7f));
  }
  
  return { value, chunk };
}

export default {
  fixedInt,
  varInt
}