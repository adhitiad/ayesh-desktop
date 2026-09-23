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
    client[method](req, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

try {
  const health = await call('HealthCheck', {});
  console.log('HealthCheck:', JSON.stringify(health));

  const files = await call('ListFiles', { path: '.' });
  console.log('ListFiles: OK,', files.files.length, 'entries');

  const skills = await call('ListSkills', {});
  console.log('ListSkills: OK,', skills.skills.length, 'skills');

  const config = await call('GetConfig', {});
  console.log('GetConfig:', JSON.stringify(config));
  console.log('ALL GRPC CALLS OK');
} catch (e) {
  console.error('GRPC ERROR:', e.message);
  process.exit(1);
}
