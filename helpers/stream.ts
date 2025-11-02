import { argv } from 'node:process';
import snappy from 'snappyjs';
import chalk from 'chalk';
import str from './string.ts';

// Options
const verboseMode = argv.some(x => str.contains(x, '--verbose'));

/** Detect strings */
function likelyString(input: Uint8Array<ArrayBuffer>) {
  // Check if all charcters fall in the "printable character" range
  // TODO: Add additional heuristics to infer type
  return input.every(x => (x >= 32 && x <= 126));
}

/** Decompress using snappy */
function unSnappy(input: Uint8Array<ArrayBuffer>) {
  let output: Uint8Array<ArrayBuffer>;
  try {
    output = snappy.uncompress(input) as Uint8Array<ArrayBuffer>;
  }
  catch {
    console.log(chalk.redBright('Failed to parse stream as snappy-compressed! Skipping...'));
    output = new Uint8Array(input);
  }

  return output;
}

/** Remove SLIP escape */
function unSlip(input: Uint8Array<ArrayBuffer>) {
  // SLIP Protocol:
  // Messages are bounded on both sides by a special byte delimiter (0xc0)
  // To escape this byte from inside the message, 0xc0 is converted to [0xdb, 0xdc]
  // To escape the escape, 0xdb is converted to [0xdb, 0xdd]
  const BYTE_DELIM = 0xc0;
  const BYTE_ESC = 0xdb;
  const BYTE_SIG = 0xdc;
  const BYTE_LIT = 0xdd;

  let verbose: string = '';
  let collector: number[] = [];
  const groups: Uint8Array<ArrayBuffer>[] = [];

  for (const byte of input) {
    if (byte === BYTE_DELIM) {
      verbose += str.hex(byte, chalk.yellow);
    }
    else if (byte === BYTE_ESC) {
      verbose += str.hex(byte, chalk.cyan);
    }
    else if (byte === BYTE_SIG) {
      verbose += str.hex(byte, chalk.red);
    }
    else if (byte === BYTE_LIT) {
      verbose += str.hex(byte, chalk.green);
    }
    else {
      verbose += str.hex(byte);
    }
  }
  
  for (let i = 0; i < input.length; i++) {
    if (input[i] === BYTE_DELIM) {
      if(collector.length > 0){
        groups.push(new Uint8Array(collector));
        collector = [];
      }
    }
    else if (input[i] == BYTE_ESC) {
      i++;
      collector.push(input[i] == BYTE_SIG ? BYTE_DELIM : BYTE_ESC);
    }
    else {
      collector.push(input[i]);
    }
  }

  if (verboseMode) {
    console.log(chalk.gray('SLIP tokens:'));
    console.log(chalk.gray(`${verbose}\n`));
  }

  return groups;
}

export default {
  likelyString,
  unSnappy,
  unSlip
}