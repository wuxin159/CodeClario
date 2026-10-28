import { setTimeout } from 'node:timers/promises';

for (let attempt = 0; attempt < 8; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/status', {
      signal: AbortSignal.timeout(5000),
    });
    const status = await response.json();
    if (response.ok && status.runner && status.ai) {
      console.log('代码灵后台服务已就绪：runner=true，ai=true。');
      process.exit(0);
    }
  } catch {
    // Startup may not have opened the local listener yet.
  }
  await setTimeout(1000);
}

console.error('后台服务未通过启动检查，请查看下面的服务日志。');
process.exitCode = 1;
