#!/usr/bin/env node
import { isIPv4, Socket } from 'node:net'
import dns from 'node:dns/promises'
import { logger } from './services/logger'
import { performance } from 'perf_hooks'
import { portSnoopBanner } from './banner'
import { table } from 'table'

type SinglePort = number
type PortArray = number[]
type PortRange = {
  start: number
  end: number
}

export type PortInput = SinglePort | PortArray | PortRange

interface ScannerOptions {
  timeout?: number
  maxConcurrent?: number
  defaultPorts?: number[]
}

interface ScanResult {
  isOpen: boolean
  service?: string
}

interface HostInfo {
  address: string
  hostname: string[]
  state: 'up' | 'down'
}

export class PortScanner {
  // eslint-disable-next-line @stylistic/max-len
  private static readonly HOSTNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  private static readonly MAX_PORT_RANGE = 1000

  private readonly options: Required<ScannerOptions>

  public constructor(options: ScannerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 1000,
      maxConcurrent: options.maxConcurrent ?? 100,
      defaultPorts: options.defaultPorts ?? [22, 80, 135], // TODO: change this
    }
  }

  public async scan(target: string, ports?: PortInput): Promise<void> {
    const start = performance.now()
    console.log(portSnoopBanner)

    try {
      await this.executeScan(target, ports)
    } catch (err) {
      const error = err instanceof Error
        ? err.message
        : new Error('Unknown error')
      logger.error(`Scan failed: ${error}`)
    } finally {
      this.logElapsedTime(start)
    }
  }

  private async resolveHost(target: string): Promise<HostInfo> {
    try {
      if (isIPv4(target)) {
        const hostnames = await dns.reverse(target).catch(() => [])
        return {
          address: target,
          hostname: hostnames,
          state: 'up',
        }
      }

      if (!PortScanner.HOSTNAME_REGEX.test(target)) {
        throw new Error('Invalid hostname format')
      }

      try {
        const addresses = await dns.resolve4(target)
        if (!addresses || addresses.length === 0) {
          throw new Error('No IPv4 addresses found')
        }

        return {
          address: addresses[0],
          hostname: [target],
          state: 'up',
        }
      } catch (dnsError) {
        const error = dnsError instanceof Error
          ? dnsError.message
          : 'Unknown error'
        logger.debug(`DNS resolution failed: ${error}`)
        throw new Error('Failed to resolve hostname')
      }
    } catch (err) {
      const error = err instanceof Error
        ? err.message
        : 'Unknown error'
      logger.error(`Failed to resolve ${target}: ${error}`)
      return {
        address: target,
        hostname: [target],
        state: 'down',
      }
    }
  }

  public async executeScan(
    target: string,
    ports: PortInput | undefined,
  ): Promise<void> {
    const startTime = new Date().toDateString()
    logger.info(`Starting PortSnoop at ${startTime}`)

    const hostInfo = await this.resolveHost(target)
    this.logHostInfo(hostInfo)

    if (hostInfo.state === 'down') {
      return
    }

    const scanResults = await this.scanPorts(hostInfo.address, ports)
    this.displayResults(scanResults)
  }

  logElapsedTime(start: number) {
    const end = performance.now()
    const elapsedTime = (end - start) / 1000
    logger.info(`Finished PortSnoop in ${elapsedTime.toFixed(2)}s`)
  }

  private async scanPort(
    address: string,
    port: number,
  ): Promise<ScanResult> {
    return new Promise((resolve) => {
      const socket = new Socket()
      let resolved = false

      const cleanup = () => {
        if (!resolved) {
          resolved = true
          socket.destroy()
          resolve({ isOpen: false })
        }
      }

      socket.setTimeout(this.options.timeout)

      socket.once('connect', async () => {
        socket.destroy()
        try {
          const { service } = await dns.lookupService(address, port)
            .catch(() => ({ service: 'unknown' }))
          resolve({ isOpen: true, service })
        } catch {
          resolve({ isOpen: true, service: 'unknown' })
        }
      })

      socket.on('error', cleanup)
      socket.on('timeout', cleanup)

      try {
        socket.connect({ port, host: address, family: 4 })
      } catch {
        cleanup()
      }
    })
  }

  private normalizePort(ports?: PortInput): number[] {
    if (!ports) {
      return this.options.defaultPorts
    }

    if (typeof ports === 'number') {
      return [ports]
    }

    if (Array.isArray(ports)) {
      return ports
    }

    const { start, end } = ports
    const range = end - start

    if (range > PortScanner.MAX_PORT_RANGE) {
      logger.warn(`Limited port range to ${PortScanner.MAX_PORT_RANGE}`)
      return Array.from(
        { length: PortScanner.MAX_PORT_RANGE },
        (_, i) => start + i,
      )
    }
    return Array.from({ length: range }, (_, i) => start + i)
  }

  private async scanPortsBatch(
    address: string,
    ports: number[],
  ): Promise<Map<number, ScanResult>> {
    const results = new Map<number, ScanResult>()
    const promises = ports.map(async (port) => {
      results.set(port, await this.scanPort(address, port))
    })

    await Promise.all(promises)

    return results
  }

  private async scanPorts(
    address: string,
    ports?: PortInput,
  ): Promise<Map<number, ScanResult>> {
    const normalizedPorts = this.normalizePort(ports)
    const results = new Map<number, ScanResult>()

    for (
      let i = 0; i < normalizedPorts.length; i += this.options.maxConcurrent
    ) {
      const batch = normalizedPorts.slice(i, i + this.options.maxConcurrent)
      const batchResults = await this.scanPortsBatch(address, batch)
      for (const [port, result] of batchResults) {
        results.set(port, result)
      }
    }

    return results
  }

  private logHostInfo(hostInfo: HostInfo) {
    if (!hostInfo.address || !hostInfo) {
      logger.error('Invalid host information')
      return
    }
    const hostname = hostInfo.hostname && hostInfo.hostname.length > 0
      ? hostInfo.hostname.length > 1
        ? hostInfo.hostname.join(', ')
        : hostInfo.hostname[0]
      : null

    if (hostname) {
      logger.info(`PortSnoop results for ${hostname} (${hostInfo.address})`)
    } else {
      logger.info(`PortSnoop results for ${hostInfo.address}`)
    }

    logger.info(`Host is ${hostInfo.state}`)
  }

  private displayResults(results: Map<number, ScanResult>) {
    const openPorts = Array.from(results.entries())
      .filter(([, { isOpen }]) => isOpen)
      .map(([port, { service }]) => ({ port, service }))

    logger.info(
        `Not shown: ${results.size - openPorts.length} filtered closed ports`,
    )

    const tableData = [
      ['PORT', 'STATUS', 'SERVICE'],
      ...openPorts.map(({ port, service }) =>
        [port, 'open', service ?? 'unknown']),
    ]
    logger.info(table(tableData))
  }
}
