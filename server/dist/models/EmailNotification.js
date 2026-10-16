"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailNotification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const EmailNotificationSchema = new mongoose_1.Schema({
    studentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    guardianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Guardian', default: null },
    classSessionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    attendanceRecordId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AttendanceRecord', required: true, index: true },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true },
    recipientName: { type: String, trim: true },
    notificationType: {
        type: String,
        enum: ['ABSENCE'],
        default: 'ABSENCE',
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED'],
        default: 'PENDING',
        index: true,
    },
    attemptCount: { type: Number, default: 0 },
    providerMessageId: { type: String, default: null },
    lastError: { type: String, default: null },
    nextAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    dedupKey: { type: String, required: true, unique: true, index: true },
}, {
    timestamps: true,
});
EmailNotificationSchema.index({ status: 1, nextAttemptAt: 1 });
exports.EmailNotification = mongoose_1.default.model('EmailNotification', EmailNotificationSchema);
