# Bitbucket Contributor Count

This repository contains a command line utility to calculate the number of unique contributors in Bitbucket over the last 90 days.

## Building the Docker Image

To build the Docker image for this utility, follow these steps:

1. Clone the repository:

   ```sh
   git clone https://github.com/stuartcmehrens/bitbucket-contributor-count.git
   cd bitbucket-contributor-count
   ```

2. Build the Docker image:
   ```sh
   docker build -t bitbucket-contributor-count .
   ```

## Running the Utility with Docker

To run the utility using Docker, use the following command:

```sh
docker run --rm bitbucket-contributor-count:latest bitbucket -t "bitbucket_token" -w "bitbucket_workspace" get-contributors
```

This will execute the utility and output the number of unique contributors in Bitbucket over the last 90 days.

Optionally, you can save the repositories fetched from the Bitbucket API to a file, which can then be used to pass into the utility during a subsequent run. This is useful if you have many repositories in a workspace since Bitbucket has a default rate limit of 1000 authenticated requests per hour:

```sh
docker run -v "$(pwd)/output":/data --rm bitbucket-contributor-count:latest bitbucket -t "bitbucket_token" -w "bitbucket_workspace" --save-repositories get-contributors
```

```sh
docker run -v "$(pwd)/output":/data --rm bitbucket-contributor-count:latest bitbucket -t "bitbucket_token" -w "bitbucket_workspace" --repositories "/data/repositories.json" get-contributors
```

Note that the utility is designed to retry failed API requests continuously with a maximum wait between retries set to 5 minutes.
