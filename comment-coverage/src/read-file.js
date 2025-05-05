import * as core from '@actions/core';
import {existsSync, readFileSync} from 'fs';

export function getContentFile(pathToFile) {
    if (!pathToFile) {
        core.warning('Path to file was not provided')
        return ''
    }

    const fixedFilePath = pathToFile.startsWith('/') ? pathToFile : `${process.env.GITHUB_WORKSPACE}/${pathToFile}`
    const fileExists = existsSync(fixedFilePath)

    if (!fileExists) {
        core.warning(`File "${pathToFile}" doesn't exist`)
        return ''
    }

    const content = readFileSync(fixedFilePath, 'utf8')

    if (!content) {
        core.warning(`No content found in file "${pathToFile}"`)
        return ''
    }

    core.info(`File read successfully "${pathToFile}"`)
    return content
}