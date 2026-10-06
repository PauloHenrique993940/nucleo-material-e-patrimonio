import { app } from './app.js';
import { db } from './repositories/db.js';
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, () => console.log(`API em http://localhost:${port}`));
const shutdown = () => {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
