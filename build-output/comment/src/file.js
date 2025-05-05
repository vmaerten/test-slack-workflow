import {createReadStream, createWriteStream, existsSync, readdirSync, rmSync, statSync} from 'fs';
import * as core from "@actions/core";
import prettyBytes from "pretty-bytes";
import {promisify} from 'node:util'
import {pipeline} from 'node:stream'
import {createBrotliCompress, createGzip} from 'node:zlib'

const pipe = promisify(pipeline);

const getFilePath = (fileName) => fileName.startsWith('/') ? fileName : `${process.env.GITHUB_WORKSPACE}/${fileName}`

const compress = async (input, output) => {
  let compressor = undefined
  if (output.endsWith('.gz')) {
    compressor = createGzip()
  } else if (output.endsWith('.br')) {
    compressor = createBrotliCompress()
  } else {
    throw new Error(`Cannot compress ${input} to ${output} , compression algorithm not known or not supported`)
  }
  const source = createReadStream(input);
  const destination = createWriteStream(output);
  await pipe(source, compressor, destination);
};

const getCompressedSize = async (filePath, extension) => {
  await compress(filePath, `${filePath}.${extension}`)
  const stat = statSync(`${filePath}.${extension}`)
  rmSync(`${filePath}.${extension}`)
  return {
    rawSize: stat.size,
    size: prettyBytes(stat.size, {space: false}),
  }
}


const getAllFiles = (fileName, regexString) => {
  core.info(`Processing ${fileName}`)
  if (!existsSync(fileName)) {
    core.warning(`File "${fileName}" doesn't exist`)
    return {
      error: 'File not found',
    }
  }

  const stat = statSync(fileName)

  let files = []
  if (stat.isDirectory()) {
    core.info(`Directory: ${fileName}`)
    const dirFiles = readdirSync(fileName);

    return dirFiles.flatMap(f => getAllFiles(`${fileName}/${f}`, regexString))
  } else {
    core.info(`File ${fileName}`)
    files = [fileName]
  }

  files = files.filter(f => new RegExp(regexString ?? '.*').test(f))

  return files.map((file) => {
    const stat = statSync(file)

    return ({
      fileName: file,
      path: getFilePath(file),
      raw: {
        rawSize: stat.size,
        size: prettyBytes(stat.size, {space: false})
      },
      matched: regexString,
    });
  })
}

export const getFileInformation = async ({baseDir, regexString}) => {
  const files = getAllFiles(baseDir, regexString)

  if (files.length > 1 && regexString) {
    throw new Error(`Regex ${regexString} matched multiple files: ${files.map(f => f.fileName).join(', ')}`)
  }

  return (await Promise.all(files.map(async file => ({
    ...file,
    baseDir,
    regexString,
    gz: await getCompressedSize(file.path, 'gz'),
    br: await getCompressedSize(file.path, 'br')
  })))).flat(Number.MAX_SAFE_INTEGER)
}
