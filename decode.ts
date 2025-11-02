import { argv } from 'node:process';
import { readFile } from "node:fs/promises";
import chalk from 'chalk';
import bin from './helpers/stream.ts';
import str from './helpers/string.ts';
import num from './helpers/number.ts';

// Options
const verboseMode = argv.some(x => str.contains(x, '--verbose'));
const useSnappy = argv.some(x => str.contains(x, '--snappy'));
const useSLIP = argv.some(x => str.contains(x, '--slip'));
const lastParam = argv[argv.length - 1];

// Working model
let model = {};

if (str.contains(lastParam, '.json')) {
  const modelText = await readFile(new URL(lastParam, import.meta.url), 'utf8');
  model = JSON.parse(modelText);
}

// Stringbuilder
const sb = { hexOutput: '', treeOutput: '' };

type LogMsg = {
  depth: number;
  nodeId: number;
  dataType?: string;
  size?: number;
  raw?: (number | ArrayLike<number>);
  parsed?: string;
  color?: ((x: string) => string);
};

// Helpers
function logNode(msg: LogMsg) {
  const format = msg.color ?? ((x: string) => x);
  const idLabel = msg.nodeId.toString().padStart(3, ' ');
  const indent = [...new Array(msg.depth).keys()].reduce((a, c, i) => `${a}---`, '');
  const chunk = ((msg.raw === undefined) ? [] : (typeof msg.raw === 'number' ? [msg.raw] : msg.raw));
  const len = (chunk.length || msg.size || 0);

  // Append to hex output
  sb.hexOutput += str.hex(msg.raw, format);

  // Append to tree output
  sb.treeOutput += (chalk.black.bgGray(indent) + chalk.bold.black.bgCyan(`${idLabel}`) + chalk.blue(` ${msg.dataType}(${len}) `) + format(msg.parsed || '') + '\n');
}

/** Full protobuf decode */
function protobuf(rawData: Uint8Array<ArrayBuffer>) {
  console.log(chalk.white('==== Protobuf Decode ====\n'));
  console.log(chalk.yellow(`raw (${rawData.length} bytes):`));
  console.log(chalk.yellowBright(str.parseString(rawData)));

  let unpacked = new Uint8Array(rawData);

  if (useSnappy) {
    console.log(chalk.white('\nDecompress with snappy...'));
    unpacked = bin.unSnappy(rawData);
    console.log(chalk.cyan(`unpacked (${unpacked.length} bytes):`));
    console.log(chalk.cyanBright(str.parseString(unpacked)));
  }

  let messages: Uint8Array<ArrayBuffer>[] = [];

  if (useSLIP) {
    console.log(chalk.white('\nRemoving SLIP escape...'));
    messages = bin.unSlip(rawData);
    console.log(chalk.white(`Found ${messages.length} message${messages.length === 1 ? '' : 's'}`));
  }
  else {
    messages.push(new Uint8Array(unpacked));
  }

  for (let i = 0; i < messages.length; i++) {
    console.log(chalk.blue(`\nMessage ${i + 1} (${messages[i].length} bytes):`));
    console.log(chalk.blueBright(str.parseString(messages[i])));
    parseNode(messages[i]);
  }
}

function parseNode(input: Uint8Array<ArrayBuffer>, depth = 0) {
  let branch = input.slice();
  let loops = 0;
  
  while (branch.length > 0 && loops < 5) {
    // Each node starts with header encoded as varint
    // Bottom 3 bits indicate type
    // The rest of the bits store the ID (tag number)
    const header = num.varInt(branch);
    const body = branch.slice(header.chunk.length);
    const nodeId = header.value >>> 3;
    const nodeType = header.value & 0x07;
    const info: LogMsg = { depth, nodeId };
    let subNode: Uint8Array<ArrayBuffer> | undefined;
    let offset = 0;

    // Log header
    sb.hexOutput += str.hex(header.chunk, chalk.cyan);

    // Extra logging
    if (verboseMode) {
      sb.treeOutput += chalk.black([...new Array(depth).keys()].reduce((a, c, i) => `${a}---`, ''));
      sb.treeOutput += chalk.cyanBright(` ${header.chunk.length}b`);
      sb.treeOutput += chalk.blueBright(` ${(body.length)} bytes\n`);
    }

    // Parse content based on type
    if (nodeType === 0) {
      // Type 0: General number
      // 1-10 bytes (variable)
      info.dataType = 'varint';
      info.color = chalk.green;

      // Content immediately follows header
      const content = num.varInt(body);
      info.raw = content.chunk;
      info.size = content.chunk.length;
      info.parsed = content.value.toString();
    }
    else if (nodeType === 1) {
      // Type 1: Fixed 64-bit number
      // 8 bytes
      info.dataType = 'fixed64';
      info.color = chalk.greenBright;

      // Content is next 8 bytes
      const content = num.fixedInt(body, 8);
      info.raw = content.chunk;
      info.size = content.chunk.length;
      info.parsed = content.value.toString();
    }
    else if (nodeType === 2) {
      // Type 2: Binary
      // Variable length
      // Could be string, sub-node, or binary data

      // First block indicates content length
      const meta = num.varInt(body);
      info.size = meta.value;
      sb.hexOutput += str.hex(meta.chunk, chalk.blue);
      offset = meta.chunk.length;

      // Content follows meta-block
      const content = body.slice(offset, offset + info.size);

      if (bin.likelyString(content)) {
        // Scenario 1: String
        // Parse as ASCII character string
        info.dataType = 'string';
        info.color = chalk.yellow;
        info.raw = content;
        info.parsed = str.parseString(content);
      }
      else {
        // Scenario 2: Sub-node
        // Store content to be parsed at the bottom of this function
        info.dataType = 'sub';
        //info.size = content.length;
        subNode = content;
      }
    }
    else if (nodeType === 3) {
      // Type 3: Group start [DEPRECATED]
      // Indicates the start of a subgroup
      info.dataType = 'groupStart';
      info.color = chalk.red;

      // This type was never really used outside of a few early implementations
      // We'll note it in case it ever comes up
      info.raw = body.slice();
      info.size = body.length;
      info.parsed = 'Unsupported type';
    }
    else if (nodeType === 4) {
      // Type 4: Group end [DEPRECATED]
      // Indicates the end of a subgroup
      info.dataType = 'groupEnd';
      info.color = chalk.red;

      // This type was never really used outside of a few early implementations
      // We'll note it in case it ever comes up
      info.raw = body.slice();
      info.size = body.length;
      info.parsed = 'Unsupported type';
    }
    else if (nodeType === 5) {
      // Type 5: Fixed 32-bit number
      // 4 bytes
      info.dataType = 'fixed32';
      info.color = chalk.greenBright;

      // Content is next 4 bytes
      const content = num.fixedInt(body, 4);
      info.raw = content.chunk;
      info.size = content.chunk.length;
      info.parsed = content.value.toString();
    }
    else {
      // Type not recognized!
      info.dataType = 'unknown';
      info.color = chalk.whiteBright.bgRed;
      info.raw = body.slice();
      info.size = body.length;
      info.parsed = `Invalid data type (${nodeType})`;
    }

    // Log what we've learned!
    logNode(info);

    // If we found a sub-node, keep parsing
    if (subNode) {
      parseNode(subNode, depth + 1);
    }

    // Remove the bytes from this branch and leave the rest for the next loop
    branch = body.slice(offset + (info.size ?? 0));
    loops++;
  }

  // Write output to console on last loop
  if (depth === 0) {
    console.log(chalk.white('\n[' + sb.hexOutput + ' ]'));
    console.log(chalk.black('\n' + sb.treeOutput));
    sb.hexOutput = '';
    sb.treeOutput = '';
  }
}

export default {
  protobuf
}