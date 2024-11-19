import { green, yellow, red, white, cyan } from 'kleur'

export enum Severity {
  success = 'success',
  warning = 'warning',
  error = 'error',
  neutral = 'neutral',
  info = 'info',
}

const LOGGERS = {
  success: green,
  warning: yellow,
  error: red,
  neutral: white,
  info: cyan,
}

export default function logger(message: string, severity: Severity = Severity.neutral) {
  // eslint-disable-next-line no-console
  console.log(LOGGERS[severity](message))
}
