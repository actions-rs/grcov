const os = require('os');
const path = require('path');

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import {Cargo} from '@actions-rs/core';

import * as configuration from './configuration';

export class Grcov {
    private readonly path: string;

    private constructor(path: string) {
        this.path = path;
    }

    public static async get(): Promise<Grcov> {
        try {
            const path = await io.which('grcov', true);

            return new Grcov(path);
        } catch (error) {
            core.info('grcov is not installed, installing now');
        }

        const cargo = await Cargo.get();
        try {
            core.startGroup('Install grcov');
            await cargo.call(['install', 'grcov']);
        } catch (error) {
            throw error;
        } finally {
            core.endGroup();
        }

        // Expecting it to be in PATH already
        return new Grcov('grcov');
    }

    public async call(config: configuration.Config, archive: string): Promise<string> {
	    const postfix = Math.random().toString(36).substring(2, 15)
        const reportPath = config.user.outputPath ? path.resolve(config.user.outputPath) : path.join(os.tmpdir(), `grcov-report-${postfix}`);

        const args = this.buildArgs(config, archive, reportPath);

        try {
            core.startGroup('Execute grcov');
            await exec.exec(this.path, args);
        } catch (error) {
            throw error;
        } finally {
            core.endGroup();
        }

        core.info(`Generated coverage report at ${reportPath}`);
        return reportPath;
    }

    buildArgs(config: configuration.Config, fromArchive: string, toFile: string): string[] {
        let args: string[] = [fromArchive];

        // flags
        if (config.user.branch) {
            args.push('--branch');
        }
        if (config.user.ignoreNotExisting) {
            args.push('--ignore-not-existing');
        }
        if (config.user.llvm) {
            args.push('--llvm');
        }

        // options
        args.push('--commit-sha');
        args.push(config.system.commitSha);

        // TODO: `GITHUB_REF` will result in a bad values
//         args.push('--vcs-branch');
//         args.push(config.system.branch);

        if (config.user.filter) {
            args.push('--filter');
            args.push(config.user.filter);
        }

        if (config.user.ignore) {
            for (const dir of config.user.ignore) {
                args.push('--ignore');
                args.push(dir);
            }
        }

        if (config.user.pathMapping) {
            for (const dir of config.user.pathMapping) {
                args.push('--path-mapping');
                args.push(dir);
            }
        }

        args.push('--output-path');
        args.push(toFile);

        if (config.user.outputType) {
            args.push('--output-type');
            args.push(config.user.outputType);
        }

        if (config.user.prefixDir) {
            args.push('--prefix-dir');
            args.push(config.user.prefixDir);
        }

        if (config.user.exclBrLine) {
            args.push('--excl-br-line');
            args.push(config.user.exclBrLine);
        }

        if (config.user.exclBrStart) {
            args.push('--excl-br-start');
            args.push(config.user.exclBrStart);
        }

        if (config.user.exclBrStop) {
            args.push('--excl-br-stop');
            args.push(config.user.exclBrStop);
        }

        if (config.user.exclLine) {
            args.push('--excl-line');
            args.push(config.user.exclLine);
        }

        if (config.user.exclStart) {
            args.push('--excl-start');
            args.push(config.user.exclStart);
        }

        if (config.user.exclStop) {
            args.push('--excl-stop');
            args.push(config.user.exclStop);
        }

        // TODO:
        // args.push('--service-job-number');
        // args.push('');

        args.push('--service-name');
        args.push(config.system.serviceName);

        // args.push('--service-number');
        // args.push('');

        args.push('--source-dir');
        args.push(config.system.workspace);

        return args;
    }
}
