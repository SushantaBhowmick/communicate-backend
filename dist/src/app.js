"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./swagger");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const messageRoutes_1 = __importDefault(require("./routes/messageRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// console.log(process.env.JWT_SECRET)
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// ✅ Swagger route
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
app.get("/", (req, res) => {
    res.status(200).json({
        status: "success-s",
        project: "Communicate-Test",
        message: "Server is healthy and running",
    });
});
app.get("/test", (req, res) => {
    console.log(req.body);
    return res.status(200).json({
        success: true,
        data: req.body,
    });
});
app.use("/api/auth", authRoutes_1.default);
app.use("/api/messages", messageRoutes_1.default);
app.use("/api/chats", chatRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
exports.default = app;
