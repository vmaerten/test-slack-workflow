import * as core from '@actions/core';
import {context, getOctokit} from '@actions/github';

async function getCurrentPullRequest(octokit, owner, repo, commitSha, ref) {
    const result = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner, repo, commit_sha: commitSha,
    });
    return result.data.find((el) => el.state === 'open' && ref === `refs/heads/${el.head.ref}`);
}

async function createCommentOnPr(octokit, owner, repo, prNumber, commentSignature, body) {
    const {data: comments} = await octokit.rest.issues.listComments({
        owner, repo, issue_number: prNumber,
    })

    const comment = comments.find((c) => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(commentSignature))

    if (comment) {
        core.info('Found previous comment, updating')
        await octokit.rest.issues.updateComment({
            repo, owner, comment_id: comment.id, body,
        })
    } else {
        core.info('No previous comment found, creating a new one')
        await octokit.rest.issues.createComment({
            repo, owner, issue_number: prNumber, body,
        })
    }
}

export async function createComment(options, body) {
    const {eventName, payload} = context
    const {repo, owner} = context.repo

    const octokit = getOctokit(options.token)

    if (eventName === 'push') {
        const pr = await getCurrentPullRequest(octokit, owner, repo, options.commit, payload.ref);

        if (pr) {
            await createCommentOnPr(octokit, owner, repo, pr.number, options.commentSignature, body);
        } else if(payload.ref !== 'main'){
            core.info('PR not found, create commit comment')
            await octokit.rest.repos.createCommitComment({
                owner, repo, commit_sha: options.commit, body,
            })
        }

    } else if (eventName === 'pull_request') {
        const prNumber = payload.pull_request?.number ?? 0
        await createCommentOnPr(octokit, owner, repo, prNumber, options.commentSignature, body);
    }
}