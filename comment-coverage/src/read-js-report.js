import * as core from '@actions/core';
import {getCoverageColor} from './coverage-color';
import {getContentFile} from './read-file';

function parseSummary(jsonContent) {
    if (!jsonContent) {
        core.warning('Summary JSON was not provided')
        return null
    }

    try {
        const json = JSON.parse(jsonContent)
        if (json.total.lines) {
            return json.total
        }
    } catch (error) {
        if (error instanceof Error) {
            core.error(`Parse summary report. ${error.message}`)
        }
    }

    return null
}

/** Get coverage and color from summary. */
function getCoverage(summary) {
    if (!summary?.lines) {
        return {coverage: 0, color: 'red'}
    }

    const {lines} = summary

    const color = getCoverageColor(lines.pct)
    const coverage = parseFloat(lines.pct.toString()).toFixed(2)

    return {coverage, color}
}

export function getJestSummaryReport(summaryFile) {

    try {
        const jsonContent = getContentFile(summaryFile)
        const summary = parseSummary(jsonContent)

        if (summary) {
            const label = 'Javascript';
            const {coverage, color} = getCoverage(summary)

            return {label, coverage, color}
        }
    } catch (error) {
        if (error instanceof Error) {
            core.error(`Generating summary report. ${error.message}`)
        }
    }

    return {label: 'error', coverage: 0, color: 'red'}
}