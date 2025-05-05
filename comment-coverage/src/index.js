import * as core from '@actions/core';
import {context, getOctokit} from '@actions/github'
import {createComment} from './create-comment';
import {getJestSummaryReport} from './read-js-report';
import {badgen} from "badgen";
import {getGoSummaryReport} from "./read-go-report";
import {getRustSummaryReport} from "./read-rust-report";

const VALID_EVENTS = ['push', 'pull_request'];
const WARNING_PERCENTAGE_THRESHOLD = 5;

function getSummaryReport(summaryType, summaryFile) {
    switch (summaryType) {
        case 'js-jest':
            return getJestSummaryReport(summaryFile)
        case 'go':
            return getGoSummaryReport(summaryFile)
        case 'rs-tarpaulin':
            return getRustSummaryReport(summaryFile)
    }
}

function getSummaryType(fileName) {
    if (fileName.endsWith("summary.json")) {
        return 'js-jest';
    }
    if (fileName.endsWith("cobertura.xml")) {
        return 'rs-tarpaulin';
    }
    if (fileName.endsWith("-coverage")) {
        return 'go';
    }

    core.setFailed(`"The file ${fileName}" could not be linked to a known coverage report. Valid file name end in: "summary.json" (jest report), "cobertura.xml" (tarpaulin report) or "-coverage" (last line of go tool report)`)
}

async function getJsonContent(octokit, owner, repo, summary, label) {
    try {
        const contentResult = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: `${summary.key}.json`,
            ref: 'coverage',
        })
        const content = Buffer.from(contentResult.data.content, 'base64').toString()
        return JSON.parse(content)
    } catch (e) {
        return {label, coverage: 'nd', color: 'red'}
    }
}

async function main() {
    const token = core.getInput('github-token')
    const octokit = getOctokit(token)
    const inputSummaries = core.getMultilineInput('summaries', {required: true})
    const {repo, owner} = context.repo
    const {eventName, payload} = context

    const summaries = inputSummaries.map(line => {
        const [title, key, summaryFile] = line.split('@');
        return {
            title,
            key,
            summaryFile,
            summaryType: getSummaryType(summaryFile),
        }
    })

    if (!VALID_EVENTS.includes(eventName)) {
        core.setFailed(`"${eventName}" event is not supported. Valid events to trigger this action are [${VALID_EVENTS}]`)
    }

    const commentSignature = `<!-- Pubstack Coverage Comment: ${context.job} -->\n`
    let commentMD = '| Module | Coverage on Main | Coverage on PR |\n' + '| --- | --- | --- |'
    const warningIntro = `\n\n:warning: The code coverage has decreased by more than ${WARNING_PERCENTAGE_THRESHOLD}% on the following components:`
    let warningList = ''
    const options = {
        token, repository: `${owner}/${repo}`, commit: '', commentSignature
    }
    if (eventName === 'pull_request' && payload) {
        options.commit = payload.pull_request?.head.sha
    } else if (eventName === 'push') {
        options.commit = payload.after
    }

    for (let summary of summaries) {
        const report = getSummaryReport(summary.summaryType, summary.summaryFile)
        const {label, coverage, color} = report

        const svgString = badgen({
            label: summary.title || label, status: `${coverage}`, color, style: 'flat'
        });

        core.startGroup(`Summary ${summary.summaryType}`)
        core.info(`label: ${label}`)
        core.info(`coverage: ${coverage}`)
        core.info(`color: ${color}`)
        core.info(`svgString: ${svgString}`)

        if(core.getInput('one-export') === 'yes') {
            core.setOutput(summary.key, JSON.stringify({key: summary.key, svg : svgString, json: {label, coverage, color}}))
        } else {
            core.setOutput(`${summary.key}-svg`, svgString)
            core.setOutput(`${summary.key}-json`, JSON.stringify({label, coverage, color}))
        }


        core.endGroup()

        const json = await getJsonContent(octokit, owner, repo, summary, label);

        const badgeOnMain = `<img alt="${json.label}: ${json.coverage}%" src="https://img.shields.io/badge/${json.label.replaceAll('-', ' ')}-${json.coverage}%25-${json.color}.svg?style=flat" />`
        const badgeOnThisPR = `<img alt="${label}: ${coverage}%" src="https://img.shields.io/badge/${label}-${coverage}%25-${color}.svg?style=flat" />`
        commentMD += `\n| ${summary.title} | ${badgeOnMain} | ${badgeOnThisPR} |`;

        const coverageProgress = ((coverage - json.coverage) / json.coverage) * 100
        if (coverageProgress < -WARNING_PERCENTAGE_THRESHOLD) {
            warningList += `\n * ${summary.title}: (${coverageProgress})`
        }
    }

    const warningMessage = warningList ? warningIntro + warningList : ''
    const body = commentSignature + commentMD + warningMessage
    await createComment(options, body);
}

main()
