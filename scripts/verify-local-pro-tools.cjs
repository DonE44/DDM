const path = require('path')
const { detectLocalProTools } = require('../electron/transcription-engines/local-pro-tools.cjs')

async function main() {
  const repoRoot = path.resolve(__dirname, '..')
  const result = await detectLocalProTools(repoRoot)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})