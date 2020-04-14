import * as os from "os";
import * as path from "path";

import * as core from "@actions/core";

import { input } from "@actions-rs/core";

import stringArgv from "string-argv";

export interface Configuration {
    args: string[];
    outputPath: string;
}

// Data for these arguments was not provided by user,
// we need to populate it manually
interface PopulateArguments {
    outputFile: boolean;
    // `GITHUB_SHA` env var
    commitSha: boolean;
    // `GITHUB_WORKFLOW` env var
    serviceName: boolean;
    // `GITHUB_RUN_ID` env var
    serviceJobId: boolean;
    // `GITHUB_WORKSPACE` env var
    sourceDir: boolean;
    // TODO: service-pull-request ?
}

function getEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable "${name}" is not defined`);
    }

    return value;
}

function getResultPath(outputType: string): string {
    const sha = getEnv("GITHUB_SHA");
    let postfix: string;
    switch (outputType) {
        case "lcov":
            postfix = `lcov-${sha}.info`;
            break;
        default:
            postfix = "coverage";
            break;
    }

    return path.join(os.tmpdir(), postfix);
}

export function getConfig(): Configuration {
    const args = stringArgv(input.getInput("args"));
    const missing: PopulateArguments = {
        outputFile: true,
        commitSha: true,
        serviceName: true,
        serviceJobId: true,
        sourceDir: true,
    };

    // Default output type for `grcov`
    let outputType = "lcov";
    let outputFile: string | undefined;

    for (const [idx, arg] of args.entries()) {
        switch (arg) {
            case "-o":
            case "--output-file":
                missing.outputFile = false;
                // Pretty naive, but for a start let's assume that
                // arguments array is formed properly and next argument
                // is really there
                outputFile = args[idx + 1];
                if (outputFile === undefined) {
                    throw new Error("--output-file parameter is missing");
                }
                break;

            case "-t":
            case "--output-type":
                // See `-o` arg parsing from above for a potential problem
                outputType = args[idx + 1];
                break;

            case "--commit-sha":
                missing.commitSha = false;
                break;

            case "--service-name":
                missing.serviceName = false;
                break;

            case "--service-job-id":
            case "--service-job-number":
                missing.serviceJobId = false;
                break;

            case "-s":
            case "--source-dir":
                missing.sourceDir = false;
                break;
        }
    }

    // Depending on `-t` argument `grcov` can create either file(s)
    // with coverage data or just flush everything into the stdout.
    // It does seems really inconvenient, so if `-o`/`--output-file`
    // was not provided by caller, replacing it with
    if (outputFile === undefined) {
        outputFile = getResultPath(outputType);
        core.info(
            `--output-file parameter is missing, coverage data will be stored at ${outputFile}`
        );
        args.unshift("--output-file", outputFile);
    }

    if (missing.commitSha) {
        args.unshift("--commit-sha", getEnv("GITHUB_SHA"));
    }
    if (missing.serviceName) {
        args.unshift("--service-name", getEnv("GITHUB_WORKFLOW"));
    }
    if (missing.serviceJobId) {
        args.unshift("--service-job-id", getEnv("GITHUB_RUN_ID"));
    }
    if (missing.sourceDir) {
        args.unshift("--source-dir", getEnv("GITHUB_WORKSPACE"));
    }

    return {
        args: args,
        outputPath: outputFile,
    };
}
