import * as core from '@actions/core';
import {context, getOctokit} from '@actions/github'
import {getFileInformation} from "./file.js";
import {createComment} from "./create-comment.js";
import prettyBytes from "pretty-bytes";

const VALID_EVENTS = ['push', 'pull_request'];
const emptyInfo = {raw: {rawSize: 0, size: '0b',}, gz: {rawSize: 0, size: '0b'}, br: {rawSize: 0, size: '0b'}}

const getOriginalFilesInformation = async (octokit, owner, repo) => {
  try {
    const contentResult = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `files.json`,
      ref: 'build-output',
    })
    const content = Buffer.from(contentResult.data.content, 'base64').toString()
    return JSON.parse(content)
  } catch (e) {
    return []
  }
};

const getCommentBody = (infos) => {
  const commentHeader = '| File | Old size | New size | Diff |\n| --- | --- | --- | --- |'
  const body = infos.reduce((body, info) => {
    const emoji = info.diff.type === 'deleted' ? ':x:' : (info.diff.type === 'added' ? ':new:' : '');
    const fileName = info.originalInfo.fileName !== info.newInfo.fileName ? [
      info.originalInfo.fileName,
      !!info.originalInfo.fileName && !!info.newInfo.fileName && ':arrow_right:',
      info.newInfo.fileName
    ].filter(s => !!s).join('<br>').trim() : info.fileName;
    const getSize = (sizeType) => `Raw:&nbsp;${info[sizeType].raw.size}<br>Gz:&nbsp;&nbsp;&nbsp;&nbsp;${info[sizeType].gz.size}<br>Br:&nbsp;&nbsp;&nbsp;&nbsp;${info[sizeType].br.size}`
    const getDiff = (sizeType) => `${info.diff[sizeType].size.startsWith('-') ? '' : '+'}${info.diff[sizeType].size}&nbsp;(${info.diff[sizeType].percent > 0 ? '+' : ''}${info.diff[sizeType].percent}%${Math.abs(info.diff[sizeType].percent) > 5 ? ' :warning:' : ''})`
    const parts = [
      `${emoji} ${fileName} `.trim(),
      getSize('originalInfo'),
      getSize('newInfo'),
      `Raw:&nbsp;${getDiff('raw')}<br>Gz:&nbsp;&nbsp;&nbsp;&nbsp;${getDiff('gz')}<br>Br:&nbsp;&nbsp;&nbsp;&nbsp;${getDiff('br')}`,
    ]
    return `${body}\n| ${parts.join(' | ')} |`;
  }, '').trim()


  return `${commentHeader}\n${body}\n`.trim()
}

const computeFilesDiff = (originalFilesInformation, filesInformation) => {
  const newInfoDiff = filesInformation.reduce((acc, fileInfo) => {
    const {fileName, regexString} = fileInfo;
    const find = (infos) => infos.find(f => regexString ? new RegExp(regexString).test(f.fileName) : f.fileName === fileName) ?? emptyInfo
    const originalInfo = find(originalFilesInformation)
    const newInfo = find(filesInformation)

    let diff;
    if(originalInfo === emptyInfo) {
      diff = {
        type: 'added',
        raw: { size: prettyBytes(newInfo.raw.rawSize, {space: false}), percent: 100,},
        gz: { size: prettyBytes(newInfo.gz.rawSize, {space: false}), percent: 100,},
        br: { size: prettyBytes(newInfo.br.rawSize, {space: false}), percent: 100,},
      }
    } else {
      diff = {
        type: 'updated',
        raw: { size: prettyBytes(newInfo.raw.rawSize - originalInfo.raw.rawSize, {space: false}), percent: (((newInfo.raw.rawSize - originalInfo.raw.rawSize) / (originalInfo.raw.rawSize || 1)) * 100).toFixed(2),},
        gz: { size: prettyBytes(newInfo.gz.rawSize - originalInfo.gz.rawSize, {space: false}), percent: (((newInfo.gz.rawSize - originalInfo.gz.rawSize) / (originalInfo.gz.rawSize || 1)) * 100).toFixed(2),},
        br: { size: prettyBytes(newInfo.br.rawSize - originalInfo.br.rawSize, {space: false}), percent: (((newInfo.br.rawSize - originalInfo.br.rawSize) / (originalInfo.br.rawSize || 1)) * 100).toFixed(2),},
      }
    }
    return [...acc, {fileName, originalInfo, newInfo, diff}]
  }, []);

  const missingOriginal = originalFilesInformation.filter(o => !newInfoDiff.find(n => n.originalInfo.fileName === o.fileName)).map(o => ({
    fileName: o.fileName,
    newInfo: emptyInfo,
    originalInfo: o,
    diff: {
      type: 'deleted',
      raw: { size: `-${prettyBytes(o.raw.rawSize, {space: false})}`, percent: -100,},
      gz: { size: `-${prettyBytes(o.gz.rawSize, {space: false})}`, percent: -100,},
      br: { size: `-${prettyBytes(o.br.rawSize, {space: false})}`, percent: -100,},
    }
  }))

  return [...newInfoDiff, ...missingOriginal].sort((a,b) => a.fileName.localeCompare(b.fileName))
};

async function main() {
  const token = core.getInput('github-token')
  const octokit = getOctokit(token)
  const inputFiles = core.getMultilineInput('files', {required: true})
  const {repo, owner} = context.repo
  const {eventName, payload} = context
  const commentSignature = `<!-- Pubstack Build Output Comment: ${context.job} -->\n`


  if (!VALID_EVENTS.includes(eventName)) {
    core.setFailed(`"${eventName}" event is not supported. Valid events to trigger this action are [${VALID_EVENTS}]`)
  }

  const filesConfig = inputFiles.map(line => {
    const [baseDir, regexString] = line.split('@');
    return {
      baseDir,
      regexString,
    }
  })
  core.debug(`Files config ${JSON.stringify(filesConfig)}`)

  const originalFilesInformation = await getOriginalFilesInformation(octokit, owner, repo)
  const filesInformation = (await (Promise.all(filesConfig.map(getFileInformation)))).flat(Number.MAX_SAFE_INTEGER)

  core.info(`Found ${filesInformation.length} files`)
  core.debug(`Original files info ${JSON.stringify(originalFilesInformation)}`)
  core.debug(`Files info ${JSON.stringify(filesInformation)}`)
  core.setOutput('filesInformation', JSON.stringify(filesInformation))

  const infos = computeFilesDiff(originalFilesInformation, filesInformation)
  core.debug(`Computed ${JSON.stringify(infos)}`)

  const body = getCommentBody(infos)

  const options = {
    token,
    repository: `${owner}/${repo}`,
    commit: eventName === 'pull_request' && payload ? payload.pull_request?.head.sha : payload.after,
    commentSignature,
  }
  await createComment(options, `${commentSignature}\n${body}`)
}

main()