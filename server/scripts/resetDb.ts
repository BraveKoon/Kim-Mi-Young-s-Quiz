/**
 * 데이터베이스 초기화 (개발용): DB 파일을 백업 폴더로 옮긴 뒤 새로 생성·시드한다.
 *   npm run db:reset -w server -- --yes
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config/index.js';
import { createContext } from '../src/context.js';
import { seed } from '../src/database/seeds/index.js';

const config = loadConfig();
if (!process.argv.includes('--yes')) {
  console.error(`⚠️  ${config.databasePath} 를 초기화합니다. 계속하려면 --yes 를 붙여 실행하세요.`);
  process.exit(1);
}
if (config.isProduction) {
  console.error('운영 환경(NODE_ENV=production)에서는 실행할 수 없습니다.');
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(path.dirname(config.databasePath), 'backups');
for (const suffix of ['', '-wal', '-shm']) {
  const f = config.databasePath + suffix;
  if (fs.existsSync(f)) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.renameSync(f, path.join(backupDir, `${path.basename(f)}.${stamp}`));
  }
}
const ctx = createContext(config);
const done = await seed(ctx.repos, config);
ctx.repos.db.close();
console.log('초기화 완료:\n - ' + done.join('\n - '));
console.log(`이전 DB는 ${backupDir} 에 보관했습니다.`);
