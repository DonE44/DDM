async function runXenovaFloat32(pipe, audioFloat32, {
  language = null,
  returnTimestamps = 'word',
  chunkLengthS = 30,
  strideLengthS = 5,
} = {}) {
  if (typeof pipe !== 'function') {
    throw new Error('runXenovaFloat32 requires a callable pipeline')
  }
  const opts = {
    task: 'transcribe',
    return_timestamps: returnTimestamps,
    chunk_length_s: chunkLengthS,
    stride_length_s: strideLengthS,
  }
  if (language) opts.language = language
  return pipe(audioFloat32, opts)
}

module.exports = {
  runXenovaFloat32,
}
