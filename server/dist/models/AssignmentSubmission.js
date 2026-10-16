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
exports.AssignmentSubmission = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AssignmentSubmissionSchema = new mongoose_1.Schema({
    assignmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    studentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    classId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    submissionText: { type: String, default: '' },
    attachmentUrl: { type: String },
    submittedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['SUBMITTED', 'GRADED', 'LATE'],
        default: 'SUBMITTED',
        index: true,
    },
    marksAwarded: { type: Number, default: null },
    feedback: { type: String, default: '' },
    gradedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
}, {
    timestamps: true,
});
AssignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
exports.AssignmentSubmission = mongoose_1.default.model('AssignmentSubmission', AssignmentSubmissionSchema);
