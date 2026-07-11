import { createServer } from "node:http";
import app from "./app.js";
import { initSocket } from "./socket.js";
import { PORT } from './constants/app.constants.js';
const httpServer = createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
