import * as core from '@actions/core';
import {writeFileSync} from "fs";

async function main() {
    const input = core.getInput('output-comment', {required: true})
    try {
        const [outputs] = JSON.parse(input)
        writeFileSync(`files.json`, JSON.stringify(outputs));

    } catch (error) {
        console.error('Something went wrong')
        console.error(error);
        core.setFailed(error.message);
    }
}

main()



