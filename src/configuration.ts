const path = require('path');
const process = require('process');
const fs = require('fs').promises;

import * as yaml from 'js-yaml';
import stringArgv from 'string-argv';
import * as core from '@actions/core';
import {input} from '@actions-rs/core';

const DEFAULT_CONFIG_PATH = '.github/actions-rs/grcov.yml';

/**
 * These value are defined by the Action inputs
 */
export interface Input {
    // `cargo test` args
    testArgs: string[],
    // Absolute path
    configPath?: string,
}

/**
 * These values are defined by users through the YAML configuration.
 */
export interface User {
    branch?: boolean,
    ignoreNotExisting?: boolean,
    llvm?: boolean,
    filter?: 'covered' | 'uncovered',
    ignore?: string[],
    outputType?: 'lcov' | 'coveralls' | 'coveralls+' | 'ade' | 'files',
    pathMapping?: string[],
    prefixDir?: string,
    outputPath?: string,
    exclBrLine?: string,
    exclBrStart?: string,
    exclBrStop?: string,
    exclLine?: string,
    exclStart?: string,
    exclStop?: string,
}

/**
 * And these are automatically gathered from the env vars
 */
export interface System {
    // GITHUB_WORKSPACE
    workspace: string,
    // GITHUB_SHA
    commitSha: string,
    // GITHUB_REF ?
    branch: string,
    // GITHUB_WORKFLOW
    serviceName: string,
}

/**
 * Configuration: The Gathering.
 */
export interface Config {
    inputs: Input,
    user: User,
    system: System,
}

function getEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable "${name}" is not defined`);
    }

    return value;
}

function loadInputs(): Input {
    if (!process.env.GITHUB_WORKSPACE) {
        throw new Error('Environment variable GITHUB_WORKSPACE is undefined. \
Did you forgot to checkout the code first?');
    }

    let inputs: Input = {
        testArgs: ['test'].concat(stringArgv(input.getInput('args'))),
    };

    const relConfigPath = input.getInput('config');
    if (relConfigPath.length > 0) {
        inputs.configPath = path.join(
            process.env.GITHUB_WORKSPACE!,
            relConfigPath,
        );
    } else {
        inputs.configPath = path.join(
            process.env.GITHUB_WORKSPACE!,
            DEFAULT_CONFIG_PATH,
        )
    }

    return inputs;
}

async function loadUser(path: string): Promise<User> {
    let contents = {};
    try {
        contents = yaml.safeLoad(await fs.readFile(path));
    } catch (error) {
        core.info(`Unable to load grcov config from the ${path}, falling back to defaults. ${error}`);
    }

    let user: User = {};
    if (contents['branch'] == true) {
        user.branch = true;
    }
    if (contents['ignore-not-existing'] == true) {
        user.ignoreNotExisting = true;
    }
    if (contents['llvm'] == true) {
        user.llvm = true;
    }
    if (contents['filter']) {
        user.filter = contents['filter'];
    }
    if (contents['ignore'] && Array.isArray(contents['ignore'])) {
        user.ignore = contents['ignore'];
    }
    if (contents['output-type']) {
        user.outputType = contents['output-type'];
    }
    if (contents['path-mapping'] && Array.isArray(contents['path-mapping'])) {
        user.pathMapping = contents['path-mapping'];
    }
    if (contents['prefix-dir']) {
        user.prefixDir = contents['prefix-dir'];
    }
    if (contents['excl-br-line']) {
        user.exclBrLine = contents['excl-br-line'];
    }
    if (contents['excl-br-start']) {
        user.exclBrStart = contents['excl-br-start'];
    }
    if (contents['excl-br-stop']) {
        user.exclBrStop = contents['excl-br-stop'];
    }
    if (contents['excl-line']) {
        user.exclLine = contents['excl-line'];
    }
    if (contents['excl-start']) {
        user.exclStart = contents['excl-start'];
    }
    if (contents['excl-stop']) {
        user.exclStop = contents['excl-stop'];
    }
    if (contents['output-path']) {
        user.outputPath = contents['output-path'];
    } else if (contents['output-file']) {
        console.warn("Configuration option `output-file` is deprecated; please replace it with `output-path`.\nFor more information, see https://github.com/actions-rs/grcov/issues/70.");
        user.outputPath = contents['output-file'];
    }

    core.debug(`User configuration: ${JSON.stringify(user)}`);

    return user;
}

async function loadSystem(): Promise<System> {
    return {
        workspace: getEnv('GITHUB_WORKSPACE'),
        commitSha: getEnv('GITHUB_SHA'),
        branch: getEnv('GITHUB_REF'),
        serviceName: getEnv('GITHUB_WORKFLOW'),
    }
}

export async function load(): Promise<Config> {
    const inputs = loadInputs();
    const system = await loadSystem();
    let user = {};
    if (inputs.configPath) {
        user = await loadUser(inputs.configPath);
    }

    return {
        inputs: inputs,
        user: user,
        system: system,
    }
}

