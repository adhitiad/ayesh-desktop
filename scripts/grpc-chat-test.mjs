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

function call(method, req) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(method + ' timeout')), 90000);
    client[method](req, (err, res) => {
      clearTimeout(t);
      err ? reject(err) : resolve(res);
    });
  });
}

const files = await call('ListFiles', { path: 'E:\\code\\fr\\ayesh-core' });
console.log('ListFiles abs:', files.files.length, 'entries');

console.log('Chat: mengirim pesan...');
const chat = await call('Chat', {
  message: 'Halo, balas satu kalimat saja: siapa kamu?',
  session_id: 'test_grpc_verify',
});
console.log('Chat agent:', chat.agent_type, '| request:', chat.request_id);
console.log('Chat content:', chat.content.slice(0, 300));
console.log('Usage:', JSON.stringify(chat.usage));
console.log('E2E CHAT OK');
