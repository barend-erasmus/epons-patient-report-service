// Imports
import * as path from 'path';
import * as winston from 'winston';
import * as yargs from 'yargs';

const argv = yargs.argv;

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ level: 'debug' }),
    new (winston.transports.File)({
      filename: path.join(__dirname, 'epons-patient-report-service.log'),
      level: 'debug',
    }),
  ],
});

// Exports
export { logger };
