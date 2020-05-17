import * as core from "@actions/core";

import * as grcov from "./grcov";
import * as args from "./args";

async function run(): Promise<void> {
    const config = args.getConfig();

    const exe = await grcov.Grcov.get();
    await exe.call(config.args);

    core.setOutput("output-path", config.outputPath);
}

async function main(): Promise<void> {
    try {
        await run();
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
