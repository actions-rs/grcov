import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";

import { Cargo } from "@actions-rs/core";

export class Grcov {
    private readonly path: string;

    private constructor(path: string) {
        this.path = path;
    }

    public static async get(): Promise<Grcov> {
        try {
            const path = await io.which("grcov", true);

            return new Grcov(path);
        } catch (error) {
            core.info("grcov is not installed, installing now");
        }

        const cargo = await Cargo.get();
        try {
            core.startGroup("Install grcov");
            await cargo.call(["install", "grcov"]);
        } finally {
            core.endGroup();
        }

        // Expecting it to be in PATH already
        return new Grcov("grcov");
    }

    public async call(args: string[]): Promise<void> {
        try {
            core.startGroup("Execute grcov");
            await exec.exec(this.path, args);
        } finally {
            core.endGroup();
        }
    }
}
