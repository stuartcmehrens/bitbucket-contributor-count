#! /usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { Command, InvalidArgumentError, Option } from 'commander';
import * as fs from 'fs';

const BITBUCKET_API_BASE_URL = 'https://api.bitbucket.org/2.0';
axios.defaults.baseURL = BITBUCKET_API_BASE_URL;
const nonRetryableStatusCodes = [400, 401, 403, 404, 500];

const getRepositories = async (
  workspace: string,
  saveRepositories?: string,
  repositories?: string,
) => {
  if (repositories) {
    try {
      console.log(`Reading repositories from file: ${repositories}`);
      const fileContent = fs.readFileSync(repositories, 'utf-8');
      return JSON.parse(fileContent) as string[];
    } catch (error) {
      console.error(`Error reading repositories from file: ${error}`);
      throw error;
    }
  }

  try {
    const repositories: string[] = [];
    let nextUrl = `/repositories/${workspace}`;
    let firstRequest = true;
    while (nextUrl) {
      const response = await makeRequest({
        method: 'GET',
        url: nextUrl,
        params: firstRequest ? { pagelen: 100 } : null,
      });

      const repos = response.data.values;
      repositories.push(...repos.map((repo: any) => repo.slug));

      firstRequest = false;
      nextUrl = response.data.next || null;
    }

    if (saveRepositories) {
      console.log(`Saving repositories to file: ${saveRepositories}`);
      fs.writeFileSync(saveRepositories, JSON.stringify(repositories));
    }
    return repositories;
  } catch (error) {
    console.error(`Error fetching repositories: ${error}`);
    throw error;
  }
};

const getStartingDate = (day: number) => {
  const now = Date.now();
  return new Date(now - day * 86_400 * 1000);
};

const getModFactor = (num: number): number => {
  if (num < 10) {
    return 1;
  }

  let i = 0;
  while (num >= 10) {
    num = Math.floor(num / 10);
    i++;
  }
  return 10 ** (i - 1);
};

const getContributors = async (workspace: string, repositories: string[]) => {
  const thirtyDaysAgo = getStartingDate(30);
  const uniqueContributors = new Set<string>();
  const modFactor = getModFactor(repositories.length);
  let i = 1;
  for (const repository of repositories) {
    let nextUrl = `/repositories/${workspace}/${repository}/commits`;
    let firstRequest = true;
    let found = false;
    while (nextUrl && !found) {
      try {
        const response = await makeRequest({
          method: 'GET',
          url: nextUrl,
          params: firstRequest
            ? {
                pagelen: 100,
              }
            : null,
        });
        const data = response.data;
        for (const commit of data.values) {
          if (new Date(commit.date) < thirtyDaysAgo) {
            found = true;
            break;
          }

          if (commit.author.user) {
            uniqueContributors.add(commit.author.user.display_name);
          } else {
            uniqueContributors.add(commit.author.raw);
          }
        }

        firstRequest = false;
        nextUrl = data.next || null;
      } catch (error) {
        console.error(
          `Error fetching contributors for repository ${repository}: ${error}`,
        );
        break;
      }
    }

    if (i >= modFactor && i % modFactor === 0) {
      console.log(
        `Processed ${i} repositories out of ${repositories.length}. Current total unique contributors: ${uniqueContributors.size}.`,
      );
    }
    i++;
  }

  return uniqueContributors;
};

const makeRequest = async (config: AxiosRequestConfig) => {
  let attempt = 0;
  const maxDelay = 300_000;
  const rateLimitMinDelay = 120_000;
  const minDelay = 5_000;
  while (true) {
    try {
      return await axios.request(config);
    } catch (error) {
      if (!(error instanceof AxiosError)) {
        throw error;
      }
      if (nonRetryableStatusCodes.includes(error.status || 500)) {
        console.error(
          `Non-retryable error: ${error.message} | ${JSON.stringify(error.response?.data, null, 2)}`,
        );
        throw error;
      }

      const delay =
        error.status === 429
          ? Math.min(maxDelay, rateLimitMinDelay * Math.pow(2, attempt))
          : Math.min(maxDelay, minDelay * Math.pow(2, attempt));
      const jitteredDelay = delay * (0.9 + Math.random() * 0.2);
      console.log(
        `Request failed: ${error.message}. Retrying in ${jitteredDelay / 1000} seconds.`,
      );
      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
      attempt++;
    }
  }
};

const getBitbucketContributors = async (options: {
  workspace: string;
  token: string;
  repositories?: string;
  saveRepositories?: string;
}) => {
  try {
    console.log(
      `Getting contributors from bitbucket workspace: ${options.workspace}`,
    );
    axios.defaults.headers.common.Authorization = `Bearer ${options.token}`;
    const repositories = await getRepositories(
      options.workspace,
      options.saveRepositories,
      options.repositories,
    );
    console.log(
      `Finished getting all repositories for workspace ${options.workspace}. Count: ${repositories.length}.`,
    );
    const contributors = await getContributors(options.workspace, repositories);
    console.log(
      `Finished getting all unique contributors from workspace ${options.workspace}. Unique contributors count: ${contributors.size}.`,
    );
  } catch (error) {
    console.error(
      `Error getting contributors from bitbucket repositories: ${error}`,
    );
    throw error;
  }
};

const program = new Command();
const bitbucket = program
  .command('bitbucket')
  .addOption(
    new Option('-t, --token <token>', 'Access token').makeOptionMandatory(true),
  )
  .addOption(
    new Option('-w, --workspace <workspace>', 'Workspace').makeOptionMandatory(
      true,
    ),
  )
  .addOption(
    new Option('--save-repositories', 'Save repositories to a file')
      .argParser((file) => {
        if (!file) {
          return '/data/repositories.json';
        }
        const fileCleansed = file.trim();
        if (fileCleansed === '') {
          return '/data/repositories.json';
        }
        return `/data/${fileCleansed}`;
      })
      .conflicts('repositories'),
  )
  .addOption(
    new Option('--repositories <file>', 'Repositories file')
      .argParser((file) => {
        if (!file) {
          throw new InvalidArgumentError('Invalid file name');
        }
        const fileCleansed = file.trim();
        if (fileCleansed === '') {
          throw new InvalidArgumentError('Invalid file name');
        }
        if (!fs.existsSync(fileCleansed)) {
          throw new InvalidArgumentError(`File ${fileCleansed} does not exist`);
        }
        return fileCleansed;
      })
      .conflicts('save-repositories'),
  );
bitbucket.command('get-contributors').action(async (_, cmd) => {
  try {
    const globalOpts = cmd.optsWithGlobals();
    await getBitbucketContributors({
      workspace: globalOpts.workspace,
      token: globalOpts.token,
      repositories: globalOpts.repositories,
      saveRepositories: globalOpts.saveRepositories,
    });
  } catch (error) {
    program.error(`Command to get bitbucket contributors failed: ${error}`);
  }
});

program.parseAsync().then(() => {});
