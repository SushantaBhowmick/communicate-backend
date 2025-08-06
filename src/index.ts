import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import dotenv from "dotenv";
import { verifyToken } from "./utils/jwt";
import { registerSocketHandlers, setSocketServer } from "./sockets";

dotenv.config();
const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Set socket server instance for use in controllers
setSocketServer(io);

io.use((socket,next)=>{
    const token = socket.handshake.auth.token;

    try {
        const decoded = verifyToken(token);
        socket.data.userId = decoded.id;
        next()
    } catch (error) {
        next(new Error('Unauthorized'));
    }
});

io.on("connection",(socket)=>{
    console.log(`✅ Socket connected: ${socket.id}`);
    registerSocketHandlers(io,socket)

});

httpServer.listen(PORT,()=>{
    console.log(`🚀 Server running at http://localhost:${PORT}`);
})
