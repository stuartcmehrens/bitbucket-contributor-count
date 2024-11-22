#! /usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { Command, Option } from 'commander';

const BITBUCKET_API_BASE_URL = 'https://api.bitbucket.org/2.0';
axios.defaults.baseURL = BITBUCKET_API_BASE_URL;

const getRepositories = async (workspace: string) => {
  try {
    const repositories: string[] = [];
    let nextUrl = `/repositories/${workspace}`;

    while (nextUrl) {
      const response = await makeRequest({
        method: 'GET',
        url: nextUrl,
        params: { pagelen: 100 },
      });

      const repos = response.data.values;
      repositories.push(...repos.map((repo: any) => repo.slug));

      nextUrl = response.data.next || null;
    }

    return repositories;
  } catch (error) {
    console.error(`Error fetching repositories: ${error}`);
    throw error;
  }
};

const getDate = (day: number) => {
  const date = new Date();
  date.setDate(date.getDate() - day);
  return date.toISOString();
};

const getContributors = async (workspace: string, repositories: string[]) => {
  const ninetyDaysAgo = getDate(90);
  const uniqueContributors = new Set<string>();
  for (const repository of repositories) {
    let nextUrl = `/repositories/${workspace}/${repository}/commits`;
    while (nextUrl) {
      const response = await makeRequest({
        method: 'GET',
        url: nextUrl,
        params: {
          q: `date >= "${ninetyDaysAgo}"`,
          pagelen: 100,
        },
      });

      const data = response.data;
      data.values.forEach(
        (commit: {
          author: { user: { display_name: string }; raw: string };
        }) => {
          if (commit.author.user) {
            uniqueContributors.add(commit.author.user.display_name);
          } else {
            uniqueContributors.add(commit.author.raw);
          }
        },
      );

      nextUrl = data.next;
    }
  }

  return uniqueContributors;
};

const makeRequest = async (config: AxiosRequestConfig) => {
  let attempt = 0;
  const maxDelay = 60_000;
  const minDelay = 1000;
  while (true) {
    try {
      const response = await axios.request(config);
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.log('Request failed: ', axiosError.message);
      const delay = Math.min(maxDelay, minDelay * Math.pow(2, attempt));
      const jitteredDelay = delay * (0.9 + Math.random() * 0.2);
      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
      attempt++;
    }
  }
};

const getBitbucketContributors = async (workspace: string, token: string) => {
  try {
    console.log(`Getting contributors from bitbucket workspace: ${workspace}`);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    const repositories = await getRepositories(workspace);
    console.log(
      `Finshed getting all repositories for workspace ${workspace}. Count: ${repositories.length}.`,
    );
    const contributors = await getContributors(workspace, repositories);
    console.log(
      `Finished getting all unique contributors from workspace ${workspace}. Unique contributors count: ${contributors.size}.`,
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
  );
bitbucket.command('get-contributors').action(async (_, cmd) => {
  try {
    const globalOpts = cmd.optsWithGlobals();
    await getBitbucketContributors(globalOpts.workspace, globalOpts.token);
  } catch (error) {
    program.error(`Command to get bitbucket contributors failed: ${error}`);
  }
});

program.parseAsync().then(() => {});
