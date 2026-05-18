#!/usr/bin/env node
/**
 * test-medium-model.mjs
 *
 * Quick test to verify Xenova/whisper-medium model:
 * 1. Checks if model is cached locally
 * 2. Loads the model via @xenova/transformers
 * 3. Reports status
 *
 * Run: node test-medium-model.mjs
 */

import path from 'path'
import fs from 'fs'
import os from 'os'

const modelId = 'Xenova/whisper-medium'
const cacheDir = path.join(os.homedir(), 'AppData', 'Roaming', 'smme', 'whisper-models')

console.log(`\n📦 Testing ${modelId} model`)
console.log(`   Cache directory: ${cacheDir}`)

// Check if model is cached
const modelDir = path.join(cacheDir, modelId)
if (fs.existsSync(modelDir)) {
  const files = fs.readdirSync(modelDir, { recursive: true })
  console.log(`\n✅ Model cached locally (${files.length} files)`)
  console.log(`   Path: ${modelDir}`)
  
  // Show key files
  const keyFiles = ['config.json', 'tokenizer.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx']
  console.log('\n   Key files:')
  keyFiles.forEach(f => {
    const fpath = path.join(modelDir, f)
    if (fs.existsSync(fpath)) {
      const size = fs.statSync(fpath).size
      const sizeMB = (size / (1024 * 1024)).toFixed(1)
      console.log(`   ✓ ${f} (${sizeMB} MB)`)
    } else {
      console.log(`   ✗ ${f} (missing)`)
    }
  })
} else {
  console.log(`\n⚠️  Model NOT cached locally`)
  console.log(`   Path: ${modelDir}`)
  process.exit(1)
}

// Try to load it
console.log(`\n🔄 Loading model with @xenova/transformers...`)

;(async () => {
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    
    env.cacheDir = cacheDir
    env.allowLocalModels = true
    env.allowRemoteModels = false  // Prevent fallback to remote
    env.useFSCache = true
    
    console.log(`   Cache dir: ${env.cacheDir}`)
    console.log(`   Remote models disabled: ${!env.allowRemoteModels}`)
    
    const pipe = await pipeline('automatic-speech-recognition', modelId, {
      quantized: true,
      progress_callback: (prog) => {
        if (prog.status) console.log(`   ${prog.status}...`)
      }
    })
    
    console.log(`\n✅ Model loaded successfully!`)
    console.log(`   Type: ${typeof pipe}`)
    console.log(`   Ready for transcription`)
    console.log(`\n🎉 MEDIUM MODEL IS WORKING!\n`)
    
  } catch (err) {
    console.error(`\n❌ Error loading model:`, err.message)
    console.error(`   Stack:`, err.stack)
    process.exit(1)
  }
})()
