#!/usr/bin/env node
import path from 'path';
import chalk from 'chalk';
import express from 'express';
import str from './helpers/string.ts';
import decode from './decode.ts';

// Helpers
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Settings
const PORT = parseInt(process.env?.PORT ?? '9999');

// API server
const app = express();

// Parsers
app.use(express.raw({ type: 'application/x-protobuf' }));
app.use(express.json({ type: 'application/json' }));
app.use(express.raw({ type: 'application/*' }));
app.use(express.text({ type: '*/*' }));

// Routes
app.all('*path', (req, res) => {
  try {
    const reqContentType = (req.get('Content-Type') || '').toLowerCase();
    console.log(chalk.gray(`\n${chalk.bgCyanBright.black(req.method)} ${chalk.cyanBright(req.url)} (${reqContentType}) [${str.typeDesc(req.body)}] `));

    if (str.contains(reqContentType, 'protobuf')) {
      const rawData = new Uint8Array(req.body);
      decode.protobuf(rawData);
    }
    else if (str.contains(reqContentType, 'octet-stream')) {
      const rawData = new Uint8Array(req.body);
      console.log(`(${chalk.blueBright('binary')}):`);
      console.log(str.parseString(rawData));
    }
    else if (Buffer.isBuffer(req.body)) {
      const rawData = new Uint8Array(req.body);
      for (const datum of rawData) {
        process.stdout.write(`0x${str.hex(datum).substring(1, 3)}, `);
      }
    }
    else if ((typeof req.body) === 'string') {
      console.log(`(${chalk.green('string')}):`);
      console.log(req.body);
    }
    else if ((typeof req.body) === 'object') {
      console.log(`(${chalk.red('unknown')}):`);
      console.log(req.body);
    }
    else {
      console.log(chalk.yellow(typeof req.body));
    }
  }
  catch (ex) {
    console.log(ex);
  }

  console.log('');
  res.status(200);
  res.end();

  setTimeout(() => process.exit(0), 100);
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
