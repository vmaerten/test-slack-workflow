export const getEnvironnement = (githubRef) => {
    const isTag = () => {
        let regExp = new RegExp("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z-");
        return regExp.test(githubRef)
    }
    if (isTag()) {
        let environnement = githubRef.slice(-4);
        if (environnement === 'prod' || environnement === 'beta') {
            return environnement;
        } else {
            throw Error('Environnment is not "prod" or "beta"')
        }
    } else {
        if (githubRef === 'refs/heads/main' || githubRef === 'refs/heads/master' || githubRef === 'refs/heads/no-docker-ci') {
            return 'dev'
        } else {
            throw Error('The branch is not main or master')
        }
    }
}
