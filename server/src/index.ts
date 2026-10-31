import { loadConfig } from './config/index.js';
import { createServer } from './server.js';

async function main() {
  const config = loadConfig();
  const server = await createServer(config);
  for (const s of server.seeded) console.log(`[seed] ${s}`);
  if (server.recovered.length) console.log(`[recover] 진행 중이던 학급 복구: ${server.recovered.join(', ')}`);
  const host = process.env.HOST ?? '0.0.0.0';
  server.httpServer.listen(config.port, host, () => {
    console.log(`ClassQuiz 서버 실행 중: http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`DB: ${config.databasePath}`);
    if (!config.isProduction && config.adminPassword === '1234') {
      console.log('⚠️  기본 관리자 계정(admin/1234)은 최초 로그인 후 비밀번호를 변경해야 합니다.');
    }
  });
  let closing = false;
  const shutdown = async (sig: string) => {
    if (closing) return;
    closing = true;
    console.log(`${sig} 수신 — 서버를 안전하게 종료합니다.`);
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('서버 시작 실패:', err instanceof Error ? err.message : err);
  process.exit(1);
});
