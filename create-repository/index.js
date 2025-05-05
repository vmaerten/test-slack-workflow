
import { Octokit } from "@octokit/action"
import * as core from '@actions/core';

async function main() {
    const octokit = new Octokit();
    const [owner,] = process.env.GITHUB_REPOSITORY.split("/");
    const name = core.getInput('name');
    const description = core.getInput('description');
    const allEnv = ['dev','beta','prod']
    try {
        const allTeam = await  octokit.rest.teams.list({
            org: owner,
        });
        const devTeam = allTeam.data.find(d => d.name === 'dev')
        console.log(`Creating new repository ${name} using pbstck/template`)
        await octokit.rest.repos.createUsingTemplate({
            template_owner: owner,
            template_repo: 'template',
            owner,
            name,
        });
        console.log('Repository created');
        const repository = {
            owner,
            repo: name,
            description,
            private: true,
            allow_squash_merge: true,
            allow_merge_commit: false,
            allow_rebase_merge: false,
            delete_branch_on_merge: true,
        };
        console.log('Update repository : ', repository)
        await octokit.rest.repos.update(repository);
        console.log('Repository created');

        console.log('Add repository to dev team with admin role')

        await octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
            org: owner,
            team_slug: 'dev',
            owner,
            repo: name,
            permission: 'admin'
        });
        console.log('Repository added to the dev team');

        console.log('Create environments')

        for (const env of allEnv) {
            console.log(env)
            await octokit.rest.repos.createOrUpdateEnvironment({
                owner,
                repo: name,
                environment_name: env,
                reviewers: env === 'prod' ? [{type:'Team', id:devTeam.id}] : null,
                deployment_branch_policy: null
            })
        }

        console.log('Environments created')
        console.log('Add protection to main branch')
        await octokit.rest.repos.updateBranchProtection({
            owner,
            repo: name,
            branch:'main',
            required_pull_request_reviews: {
                required_approving_review_count: 1
            },
            enforce_admins: null,
            required_status_checks: null,
            restrictions: null
        })
        console.log('Activate dependabot vulnerability alerts')
        await octokit.rest.repos.enableVulnerabilityAlerts({
            owner,
            repo: name
        })
    } catch (error) {
        console.error('Something went wrong')
        console.error(error);
        core.setFailed(error.message);
    }




}


main()
