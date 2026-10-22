// Command-line scan for agents and scripts: node src/cli.js mystore.com
import { scanStore } from './scan.js';
import { loadConfig } from './config.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node src/cli.js <store-url>');
  process.exit(2);
}
const { scan } = loadConfig();
try {
  const report = await scanStore(target, { maxProducts: scan.maxProducts, fetcherOptions: { maxRequests: scan.maxRequests, timeoutMs: scan.timeoutMs, maxBytes: scan.maxBytes } });
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error(JSON.stringify({ error: e.code || 'scan_failed', message: e.message }));
  process.exit(1);
}
