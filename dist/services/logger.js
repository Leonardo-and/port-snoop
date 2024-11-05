"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = require("winston");
exports.logger = (0, winston_1.createLogger)({
    level: 'info',
    format: winston_1.format.combine(winston_1.format.printf(({ message }) => message)),
    transports: [
        new winston_1.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            dirname: 'logs',
        }),
        new winston_1.transports.File({
            filename: 'combined.log',
            dirname: 'logs',
        }),
        new winston_1.transports.Console(),
    ],
});
//# sourceMappingURL=logger.js.map