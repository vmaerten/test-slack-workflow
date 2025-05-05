import * as core from '@actions/core';
import {getCoverageColor} from './coverage-color';
import {getContentFile} from './read-file';

/** Get coverage and color from summary. */
function getCoverage(summary) {
    const split = summary.split("(statements)");
    if (!split) {
        return {coverage: 0, color: 'red'}
    }

    const coverage = parseFloat(split[1]).toFixed(2)
    const color = getCoverageColor(coverage)

    return {coverage, color}
}

export function getGoSummaryReport(summaryFile) {

    try {
        const summary = getContentFile(summaryFile)

        if (summary) {
            const label = 'Go';
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