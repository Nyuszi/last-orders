import { createServer, getServerPort } from '@devvit/web/server';
import { app } from './app';

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
