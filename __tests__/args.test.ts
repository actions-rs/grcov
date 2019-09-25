const testEnvVars = {
}

describe('actions-rs/grcov', () => {
    beforeEach(() => {
    for (const key in testEnvVars)
        process.env[key] = testEnvVars[key as keyof typeof testEnvVars]
    })

    it('Should do something', async () => {
    });
});
