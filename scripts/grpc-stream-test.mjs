import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const def = protoLoader.loadSync(path.join(root, 'proto', 'ayesh.proto'), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const ayesh = grpc.loadPackageDefinition(def).ayesh;
const client = new ayesh.AyeshService('localhost:50051', grpc.credentials.createInsecure());

const stream = client.ChatStream();
let chunks = 0;
let tokens = 0;
let sawDone = false;
let content = '';

const timer = setTimeout(() => {
  console.error('TIMEOUT: stream tidak selesai dalam 240s | chunks=' + chunks);
  process.exit(2);
}, 240000);

stream.on('data', (c) => {
  chunks++;
  if (c.token) {
    tokens++;
    content += c.token;
  }
  if (c.done) {
    sawDone = true;
    clearTimeout(timer);
    console.log('ChatStream OK | chunks=' + chunks + ' tokens=' + tokens);
    console.log('usage=' + JSON.stringify(c.usage));
    console.log('content=[' + content.slice(0, 400) + ']');
    stream.end();
    process.exit(0);
  }
});
stream.on('error', (e) => {
  clearTimeout(timer);
  console.error('STREAM ERROR:', e.message);
  process.exit(1);
});

console.log('sending...');
stream.write({ message: 'Halo, balas satu kalimat saja.', session_id: 'test_stream_verify', interrupt: false });
