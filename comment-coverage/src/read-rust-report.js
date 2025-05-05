import * as core from '@actions/core';
import {getCoverageColor} from './coverage-color';
import {getContentFile} from './read-file';
import {JSDOM} from "jsdom";

/** Get coverage and color from summary. */
function getCoverage(summary) {
    const jsdom = new JSDOM( summary, {
        contentType: 'text/xml'
    });
    const lineRate = jsdom.window.document.getElementsByTagName('coverage')[0].getAttribute('line-rate')
    // line-rate is the direct ratio of lines covered, so a number between 0 and 1
    const coverage = parseFloat(100. * lineRate).toFixed(2)
    const color = getCoverageColor(coverage)

    return {coverage, color}
}

export function getRustSummaryReport(summaryFile) {

    try {
        const summary = getContentFile(summaryFile)

        if (summary) {
            const label = 'Rust';
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