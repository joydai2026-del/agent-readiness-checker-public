// Start the server: npm start
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = createServer({ config });
server.listen(config.port, config.host, () => {
  const { port } = server.address();
  const pay = { test: 'Stripe test mode is on.', missing: 'Payments: test mode not configured (no key).', refused: 'Payments OFF: the Stripe key given is not a test key, so it was refused.' }[config.stripe.keyStatus];
  console.log(`Agent Readiness Checker running at http://${config.host}:${port}`);
  console.log(pay);
});
