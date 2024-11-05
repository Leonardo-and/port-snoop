import { format, transports, createLogger } from 'winston'

export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.printf(({ message }) => message),
  ),
  transports: [
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      dirname: 'logs',
    }),
    new transports.File({
      filename: 'combined.log',
      dirname: 'logs',
    }),
    new transports.Console(),
  ],
})
