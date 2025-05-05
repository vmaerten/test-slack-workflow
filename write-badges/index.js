import * as core from '@actions/core';
import {existsSync,mkdirSync,writeFileSync} from "fs";

async function main() {
    const inputCoverage = core.getInput('output-coverage', {required: true})
    try {
        const coverages = JSON.parse(inputCoverage)
        if (!existsSync('./badges')) {
            mkdirSync('./badges');
        }
        for(const badge of coverages) {
            writeFileSync(`badges/${badge.key}.svg`, badge.svg);
            writeFileSync(`${badge.key}.json`, JSON.stringify(badge.json));
        }

    } catch (error) {
        console.error('Something went wrong')
        console.error(error);
        core.setFailed(error.message);
    }
}

main()
