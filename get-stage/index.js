import {  getEnvironnement } from "./getEnvironnement.js";

import { setOutput, setFailed } from "@actions/core";
import { context } from "@actions/github";

try {
    let environnement = getEnvironnement(context.ref);
    setOutput('target_env', environnement);
} catch (e) {
    setFailed(e.message)
}
