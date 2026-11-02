#!/usr/bin/env node
import { main } from '../src/tools.js'

main(process.argv.slice(2)).then(code => {
  process.exitCode = code
}).catch(error => {
  console.error(error?.stack || String(error))
  process.exitCode = 1
})
