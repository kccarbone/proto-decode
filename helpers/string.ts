import chalk from 'chalk';

/** Case-insensitive contains */
const contains = (hay: string, needle: string) => Boolean((hay || '').toLowerCase().indexOf((needle || '').toLowerCase()) >= 0);

/** Produce a string description of the object type */
function typeDesc(input: any) {
  const obj = (input || '');

  if (Buffer.isBuffer(obj)) {
    return 'Buffer';
  }
  if (Array.isArray(obj)) {
    return 'Array';
  }
  
  return (typeof input);
}

/** String formatting for byte(s) */
function hex(input?: (number | ArrayLike<number>), color?: ((x: string) => string)): string {
  const format = color ?? ((x: string) => x);

  if (typeof input === 'number') {
    return format(`[${input.toString(16).padStart(2, '0')}]`);
  }
  else if (input) {
    return Array.from(input, x => hex(x, color)).join('');
  }

  return '';
}

/** Try to turn bytes into string (and highlight non-printable chars) */
function parseString(input: Uint8Array<ArrayBuffer>) {
  let result = '';

  for (let i = 0; i < input.length; i++) {
    if (input[i] >= 32 && input[i] <= 126) {
      result += String.fromCharCode(input[i]);
    }
    else {
      result += hex(input[i], chalk.bgGray.black);
    }
  }

  return result;
}

export default {
  contains,
  typeDesc,
  hex,
  parseString
}