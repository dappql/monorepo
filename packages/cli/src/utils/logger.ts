import kleur from 'kleur'

const { green, yellow, red, white } = kleur

export enum Severity {
  error,
  warning,
  success,
  info,
}

export default function logger(message: string, severity: Severity = Severity.info) {
  switch (severity) {
    case Severity.error:
      console.log(red(message))
      break
    case Severity.warning:
      console.log(yellow(message))
      break
    case Severity.success:
      console.log(green(message))
      break
    default:
      console.log(white(message))
  }
}
