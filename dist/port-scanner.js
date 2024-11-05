#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortScanner = void 0;
const node_net_1 = require("node:net");
const promises_1 = __importDefault(require("node:dns/promises"));
const logger_1 = require("./services/logger");
const perf_hooks_1 = require("perf_hooks");
const banner_1 = require("./banner");
const table_1 = require("table");
class PortScanner {
    constructor(options = {}) {
        var _a, _b, _c;
        this.options = {
            timeout: (_a = options.timeout) !== null && _a !== void 0 ? _a : 1000,
            maxConcurrent: (_b = options.maxConcurrent) !== null && _b !== void 0 ? _b : 100,
            defaultPorts: (_c = options.defaultPorts) !== null && _c !== void 0 ? _c : [22, 80, 135],
        };
    }
    async scan(target, ports) {
        const start = perf_hooks_1.performance.now();
        console.log(banner_1.portSnoopBanner);
        try {
            await this.executeScan(target, ports);
        }
        catch (err) {
            const error = err instanceof Error
                ? err.message
                : new Error('Unknown error');
            logger_1.logger.error(`Scan failed: ${error}`);
        }
        finally {
            this.logElapsedTime(start);
        }
    }
    async resolveHost(target) {
        try {
            if ((0, node_net_1.isIPv4)(target)) {
                const hostnames = await promises_1.default.reverse(target).catch(() => []);
                return {
                    address: target,
                    hostname: hostnames,
                    state: 'up',
                };
            }
            if (!PortScanner.HOSTNAME_REGEX.test(target)) {
                throw new Error('Invalid hostname format');
            }
            try {
                const addresses = await promises_1.default.resolve4(target);
                if (!addresses || addresses.length === 0) {
                    throw new Error('No IPv4 addresses found');
                }
                return {
                    address: addresses[0],
                    hostname: [target],
                    state: 'up',
                };
            }
            catch (dnsError) {
                const error = dnsError instanceof Error
                    ? dnsError.message
                    : 'Unknown error';
                logger_1.logger.debug(`DNS resolution failed: ${error}`);
                throw new Error('Failed to resolve hostname');
            }
        }
        catch (err) {
            const error = err instanceof Error
                ? err.message
                : 'Unknown error';
            logger_1.logger.error(`Failed to resolve ${target}: ${error}`);
            return {
                address: target,
                hostname: [target],
                state: 'down',
            };
        }
    }
    async executeScan(target, ports) {
        const startTime = new Date().toDateString();
        logger_1.logger.info(`Starting PortSnoop at ${startTime}`);
        const hostInfo = await this.resolveHost(target);
        this.logHostInfo(hostInfo);
        if (hostInfo.state === 'down') {
            return;
        }
        const scanResults = await this.scanPorts(hostInfo.address, ports);
        this.displayResults(scanResults);
    }
    logElapsedTime(start) {
        const end = perf_hooks_1.performance.now();
        const elapsedTime = (end - start) / 1000;
        logger_1.logger.info(`Finished PortSnoop in ${elapsedTime.toFixed(2)}s`);
    }
    async scanPort(address, port) {
        return new Promise((resolve) => {
            const socket = new node_net_1.Socket();
            let resolved = false;
            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve({ isOpen: false });
                }
            };
            socket.setTimeout(this.options.timeout);
            socket.once('connect', async () => {
                socket.destroy();
                try {
                    const { service } = await promises_1.default.lookupService(address, port)
                        .catch(() => ({ service: 'unknown' }));
                    resolve({ isOpen: true, service });
                }
                catch {
                    resolve({ isOpen: true, service: 'unknown' });
                }
            });
            socket.on('error', cleanup);
            socket.on('timeout', cleanup);
            try {
                socket.connect({ port, host: address, family: 4 });
            }
            catch {
                cleanup();
            }
        });
    }
    normalizePort(ports) {
        if (!ports) {
            return this.options.defaultPorts;
        }
        if (typeof ports === 'number') {
            return [ports];
        }
        if (Array.isArray(ports)) {
            return ports;
        }
        const { start, end } = ports;
        const range = end - start;
        if (range > PortScanner.MAX_PORT_RANGE) {
            logger_1.logger.warn(`Limited port range to ${PortScanner.MAX_PORT_RANGE}`);
            return Array.from({ length: PortScanner.MAX_PORT_RANGE }, (_, i) => start + i);
        }
        return Array.from({ length: range }, (_, i) => start + i);
    }
    async scanPortsBatch(address, ports) {
        const results = new Map();
        const promises = ports.map(async (port) => {
            results.set(port, await this.scanPort(address, port));
        });
        await Promise.all(promises);
        return results;
    }
    async scanPorts(address, ports) {
        const normalizedPorts = this.normalizePort(ports);
        const results = new Map();
        for (let i = 0; i < normalizedPorts.length; i += this.options.maxConcurrent) {
            const batch = normalizedPorts.slice(i, i + this.options.maxConcurrent);
            const batchResults = await this.scanPortsBatch(address, batch);
            for (const [port, result] of batchResults) {
                results.set(port, result);
            }
        }
        return results;
    }
    logHostInfo(hostInfo) {
        if (!hostInfo.address || !hostInfo) {
            logger_1.logger.error('Invalid host information');
            return;
        }
        const hostname = hostInfo.hostname && hostInfo.hostname.length > 0
            ? hostInfo.hostname.length > 1
                ? hostInfo.hostname.join(', ')
                : hostInfo.hostname[0]
            : null;
        if (hostname) {
            logger_1.logger.info(`PortSnoop results for ${hostname} (${hostInfo.address})`);
        }
        else {
            logger_1.logger.info(`PortSnoop results for ${hostInfo.address}`);
        }
        logger_1.logger.info(`Host is ${hostInfo.state}`);
    }
    displayResults(results) {
        const openPorts = Array.from(results.entries())
            .filter(([, { isOpen }]) => isOpen)
            .map(([port, { service }]) => ({ port, service }));
        logger_1.logger.info(`Not shown: ${results.size - openPorts.length} filtered closed ports`);
        const tableData = [
            ['PORT', 'STATUS', 'SERVICE'],
            ...openPorts.map(({ port, service }) => [port, 'open', service !== null && service !== void 0 ? service : 'unknown']),
        ];
        logger_1.logger.info((0, table_1.table)(tableData));
    }
}
exports.PortScanner = PortScanner;
PortScanner.HOSTNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
PortScanner.MAX_PORT_RANGE = 1000;
//# sourceMappingURL=port-scanner.js.map