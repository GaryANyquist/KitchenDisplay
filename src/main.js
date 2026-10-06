import { loadConfig } from './config.js';
import { createKitchenServer } from './server.js';
import { getPool } from './db.js';

const config = loadConfig();
getPool(config.sql)
  .then(() => console.log(`Connected to ${config.sql.database} on ${config.sql.server}`))
  .catch((err) => console.error(`Can't reach the database yet (${err.message}); will retry on each request.`));

createKitchenServer(config).listen(config.port, config.host, () => {
  console.log(`Kitchen display: http://localhost:${config.port}`);
});
