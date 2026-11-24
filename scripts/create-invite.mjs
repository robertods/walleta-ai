import { createHash, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const code = 'walleta-' + randomBytes(12).toString('hex').match(/.{6}/g).join('-');
const hash = createHash('sha256').update(code).digest('hex');

await writeFile('CODIGO-WALLETA.txt', code + '\n', { flag: 'wx', mode: 0o600 });
await writeFile('.env.local', 'VITE_WALLETA_INVITE_SHA256=' + hash + '\n', { flag: 'a', mode: 0o600 });
console.log('Código guardado en CODIGO-WALLETA.txt y verificador en .env.local.');
