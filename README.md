# PortSnoop 🔍

PortSnoop is a fast and efficient port scanner built with TypeScript and Node.js. Easily discover open ports and services on network hosts through a simple CLI or programmatic API.

## Features

- 🚀 Fast concurrent port scanning
- 🎯 Scan single ports, ranges, or custom port lists
- 🔍 Automatic service detection
- 📡 DNS resolution and reverse lookup
- 💻 Easy-to-use CLI interface
- 🛠️ Configurable scanning parameters

## Installation

```bash
# Clone the repository
git clone https://github.com/Leonardo-and/port-snoop.git

# Navigate to project directory
cd portsnoop

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### CLI

```bash
# Scan default ports
npm start example.com

# Scan specific port
npm start example.com -p 80

# Scan multiple ports
npm start example.com -p 80,443,8080

# Scan port range
npm start example.com -p 1-1000

# Custom timeout and concurrency
npm start example.com -p 1-100 -t 2000 -c 50
```

### In Your Code

```typescript
import { PortScanner } from './port-scanner';

const scanner = new PortScanner({
  timeout: 2000,    // 2 seconds
  maxConcurrent: 50 // concurrent scans
});

// Single port
await scanner.scan('example.com', 80);

// Multiple ports
await scanner.scan('example.com', [80, 443, 8080]);

// Port range
await scanner.scan('example.com', { start: 1, end: 1000 });
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `timeout` | Scan timeout (ms) | 1000 |
| `maxConcurrent` | Max concurrent scans | 100 |
| `defaultPorts` | Default ports | [22, 80, 135] |

## Example Output

```
Starting PortSnoop at Mon Nov 04 2024
PortSnoop results for example.com (93.184.216.34)
Host is up

Not shown: 997 filtered closed ports
PORT    STATUS    SERVICE
80      open      http
443     open      https
8080    open      http-proxy
```

## Scripts

```bash
npm run build      # Build the project
npm run start      # Run the scanner
npm run dev        # Run in development
```

## License

MIT © Leonardo Andres
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Warning

⚠️ Only scan networks and systems you have permission to test. Unauthorized port scanning may be illegal.
