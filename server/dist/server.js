"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const notificationWorker_1 = require("./services/notificationWorker");
const emailService_1 = require("./services/emailService");
const attendanceWindow_1 = require("./services/attendanceWindow");
const assignmentPublicationWorker_1 = require("./services/assignmentPublicationWorker");
const app = (0, express_1.default)();
// Security middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.ENV.CLIENT_URL,
    credentials: true,
}));
app.use(rateLimiter_1.generalLimiter);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Institute Class LMS API',
    });
});
// API Routes
app.use('/api', routes_1.default);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
const startServer = async () => {
    await (0, db_1.connectDB)();
    await (0, emailService_1.initEmailTransporter)();
    (0, notificationWorker_1.startNotificationWorker)();
    (0, attendanceWindow_1.startAttendanceWindowWorker)();
    (0, assignmentPublicationWorker_1.startAssignmentPublicationWorker)();
    app.listen(env_1.ENV.PORT, () => {
        console.log(`[Server] Institute LMS Server running on http://localhost:${env_1.ENV.PORT} in ${env_1.ENV.NODE_ENV} mode`);
    });
};
startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
});
exports.default = app;
