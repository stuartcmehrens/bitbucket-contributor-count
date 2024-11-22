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
