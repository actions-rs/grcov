const os = require('os');
const path = require('path');

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import {Cargo} from '@actions-rs/core';
const { Octokit } = require("@octokit/action");
const tc = require('@actions/tool-cache');

import * as configuration from './configuration';

export class Grcov {
    private readonly path: string;

    private constructor(path: string) {
        this.path = path;
    }

    static async install(): Promise<void> {
        try {
            core.startGroup('Install grcov (from releases)');
            if (process.env.GITHUB_TOKEN === undefined) {
                core.warning("Define GITHUB_TOKEN into the step environment to have access to the published releases. Adding `env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }` to your step is usually enough")
                throw "env.GITHUB_TOKEN not defined";
            }
            const data = await new Octokit().graphql(`
                {
                  repository(owner: "mozilla", name: "grcov") {
                    releases(last: 1) {
                      edges {
                        node {
                          releaseAssets(name: "grcov-linux-x86_64.tar.bz2", last: 1) {
                            edges {
                              node {
                                downloadUrl,
                                release {
                                  tagName
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
            `);
            const tagName = data.repository.releases.edges[0].node.releaseAssets.edges[0].node.release.tagName;
            const downloadUrl = data.repository.releases.edges[0].node.releaseAssets.edges[0].node.downloadUrl;
            core.info("Installing grcov (" + tagName + ") from " + downloadUrl);
            const grcovTarBz2Path = await tc.downloadTool(downloadUrl);
            const grcovTarBz2ExtractedFolder = await tc.extractTar(grcovTarBz2Path, process.env.RUNNER_TEMP, "xj");
            core.addPath(grcovTarBz2ExtractedFolder);
            return ;
        } catch (error) {
            console.log(error);
            core.error(error);
        } finally {
            core.endGroup();
        }

        const cargo = await Cargo.get();
        try {
            core.startGroup('Install grcov (from sources)');
            await cargo.call(['install', 'grcov']);
        } catch (error) {
            throw error;
        } finally {
            core.endGroup();
        }
    }

    public static async get(): Promise<Grcov> {
        try {
            const path = await io.which('grcov', true);

            return new Grcov(path);
        } catch (error) {
            core.info('grcov is not installed, installing now');
        }

        await Grcov.install();

        // Expecting it to be in PATH already
        const grcovInstance = new Grcov('grcov');

        await exec.exec(grcovInstance.path, ['--version']);

        return grcovInstance;
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
