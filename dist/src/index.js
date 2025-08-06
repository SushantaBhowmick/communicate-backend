"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const jwt_1 = require("./utils/jwt");
const sockets_1 = require("./sockets");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
const httpServer = (0, http_1.createServer)(app_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
    },
});
// Set socket server instance for use in controllers
(0, sockets_1.setSocketServer)(io);
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
        const decoded = (0, jwt_1.verifyToken)(token);
        socket.data.userId = decoded.id;
        next();
    }
    catch (error) {
        next(new Error('Unauthorized'));
    }
});
io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);
    (0, sockets_1.registerSocketHandlers)(io, socket);
});
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
