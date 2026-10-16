"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, _req, res, _next) => {
    console.error('[Error Middleware]:', err);
    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        res.status(409).json({
            error: `A record with this ${field} already exists.`,
        });
        return;
    }
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        res.status(400).json({
            error: messages.join(', '),
        });
        return;
    }
    // CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        res.status(400).json({
            error: 'Invalid ID format provided.',
        });
        return;
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error occurred.',
    });
};
exports.errorHandler = errorHandler;
