import { Octokit } from '@octokit/action'
import * as github from '@actions/github'
import * as core from '@actions/core'

const getEnvironment = (tag) => {
  const env = tag.split('-').pop()
  if (env !== 'beta' && env !== 'prod') {
    throw Error('Unknown environment')
  }
  return env
}

const getPreviousTagWithEnv = (allTags, env) => allTags.filter((t) => {
  const tagEnv = t.name.split('-').pop()
  return tagEnv === env
})[1]

async function main() {
  const octokit = new Octokit()
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
  const tagRef = github.context.payload.ref
  const [, refType, tagName] = tagRef.split('/')
  if (refType !== 'tags') {
    throw new Error('It should be invoked only on a tag')
  }
  const parseEnv = core.getInput('parse_env')

  const allTags = await octokit.rest.repos.listTags({
    owner,
    repo,
  })

  let previousTag = allTags.data[1]
  if (parseEnv === 'yes') {
    const env = getEnvironment(tagName)
    previousTag = getPreviousTagWithEnv(allTags.data, env)
  }

  const data = {
    owner,
    repo,
    tag_name: tagRef,
  }

  if (previousTag) {
    data.previous_tag_name = previousTag.name
    console.log('Previous tag', previousTag.name)
  }

  console.log('tag', tagRef)
  const { data: { body } } = await octokit.rest.repos.generateReleaseNotes(data)
  await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tagRef,
    name: tagName,
    body,
  })
}

main()
