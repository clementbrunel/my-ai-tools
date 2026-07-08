import log from 'loglevel';

log.setLevel(import.meta.env.DEV ? 'debug' : 'warn');

export const logger = log;
