import { spawn } from 'node:child_process'

const services = [
  ['frontend', ['--workspace', 'frontend', 'run', 'dev']],
  ['socket', ['--workspace', 'socket-server', 'run', 'dev']],
  ['transactions', ['--workspace', 'transaction-server', 'run', 'dev']],
]

let shuttingDown = false

const children = services.map(([name, args]) => {
  const child = spawn('npm', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  child.stdout.on('data', data => {
    process.stdout.write(prefixLines(name, data))
  })

  child.stderr.on('data', data => {
    process.stderr.write(prefixLines(name, data))
  })

  child.on('exit', code => {
    if (code && !shuttingDown) {
      console.error(`[${name}] exited with code ${code}`)
      shutdown(code)
    }
  })

  return child
})

function prefixLines(name, data) {
  return String(data)
    .split(/\r?\n/)
    .map((line, index, lines) => {
      if (index === lines.length - 1 && line === '') return ''
      return `[${name}] ${line}`
    })
    .join('\n')
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }

  setTimeout(() => process.exit(code), 300)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
