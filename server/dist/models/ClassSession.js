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
exports.ClassSession = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ClassSessionSchema = new mongoose_1.Schema({
    classId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    sessionDate: { type: Date, required: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    title: { type: String, trim: true, default: '' },
    timeZone: { type: String, trim: true, default: 'Asia/Colombo' },
    status: {
        type: String,
        enum: ['DRAFT', 'SUBMITTED', 'LOCKED'],
        default: 'DRAFT',
        index: true,
    },
    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    autoFinalizedAt: { type: Date, default: null },
}, {
    timestamps: true,
});
ClassSessionSchema.index({ classId: 1, sessionDate: 1 });
ClassSessionSchema.index({ classId: 1, isPublished: 1, sessionDate: -1 });
exports.ClassSession = mongoose_1.default.model('ClassSession', ClassSessionSchema);
