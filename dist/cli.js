"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortScannerCLI = void 0;
const port_scanner_1 = require("./port-scanner");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
class PortScannerCLI {
    static parsePortInput(input) {
        if (!input) {
            return undefined;
        }
        const trimmedInput = input.trim();
        if (trimmedInput.includes('-')) {
            const [start, end] = trimmedInput.split('-').map(Number);
            if (isNaN(start) || isNaN(end)) {
                throw new Error('Invalid port range format. Expected format: start-end');
            }
            return { start, end };
        }
        if (trimmedInput.includes(',')) {
            const ports = trimmedInput.split(',').map(Number);
            if (ports.some(isNaN)) {
                throw new Error('Invalid port list format. Expected format: port1,port2,port3');
            }
            return ports;
        }
        const port = Number(input);
        if (isNaN(port)) {
            throw new Error('Invalid port number');
        }
        return port;
    }
    static async run() {
        const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
            .usage('Usage: $0 [options] <target>')
            .command('$0 <target>', 'Scan ports on specified target')
            .positional('target', {
            type: 'string',
            description: 'Host to scan',
            demandOption: true,
        })
            .option('port', {
            alias: 'p',
            description: 'Port(s) to scan (single port, comma-separated list, or range with hyphen)',
            type: 'string',
        })
            .option('timeout', {
            alias: 't',
            description: 'Timeout in milliseconds for each port scan',
            type: 'number',
            default: 1000,
        })
            .option('concurrent', {
            alias: 'c',
            description: 'Maximum number of concurrent port scans',
            type: 'number',
            default: 100,
        })
            .example('$0 example.com', 'Scan default ports on example.com')
            .example('$0 example.com -p 80', 'Scan port 80 on example.com')
            .example('$0 example.com -p 80,443,8080', 'Scan multiple ports')
            .example('$0 example.com -p 1-1000', 'Scan port range 1-1000')
            .help()
            .parseSync();
        try {
            const scanner = new port_scanner_1.PortScanner({
                timeout: argv.timeout,
                maxConcurrent: argv.concurrent,
            });
            const ports = this.parsePortInput(argv.port);
            await scanner.scan(argv.target, ports);
        }
        catch (err) {
            const error = err instanceof Error
                ? err.message
                : 'Unknown error';
            console.error('Error:', error);
            process.exit(1);
        }
    }
}
exports.PortScannerCLI = PortScannerCLI;
if (require.main === module) {
    PortScannerCLI.run();
}
//# sourceMappingURL=cli.js.map