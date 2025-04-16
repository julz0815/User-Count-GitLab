# GitLab User Count Script

This script connects to GitLab using a Personal Access Token (PAT), reads all repositories the PAT has access to, and counts unique committing users from the last 90 days.

## Features

- Optional GitLab host URL (defaults to https://gitlab.com)
- Interactive mode for repository selection
- Caching of repository data
- Customizable regex pattern for contributor filtering
- Force refresh option to bypass cache
- Detailed per-repository committer tracking
- Automatic retry mechanism for failed requests
- Rate limiting and throttling
- Progress tracking and detailed logging
- Multiple output formats for contributor data

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Usage

After building the project, you can run the script using:

```bash
# Basic usage with just PAT (uses default host https://gitlab.com)
node dist/index.js <PAT>

# With custom host
node dist/index.js <PAT> <HOST_URL>

# Interactive mode with default host
node dist/index.js <PAT> --interactive

# Force refresh repositories with default host
node dist/index.js <PAT> --force-refresh

# Interactive mode with force refresh and custom host
node dist/index.js <PAT> <HOST_URL> --interactive --force-refresh

# With custom regex pattern
node dist/index.js <PAT> --regex '/gitlab\\.com$/i'

# With regex pattern from file
node dist/index.js <PAT> --regex-file regex-pattern.txt
```

## Command Line Options

- `--interactive`: Enable interactive repository selection
- `--force-refresh`: Force reload of repositories and clear cached commit data
- `--regex <pattern>`: Use custom regex pattern for email categorization
- `--regex-file <file>`: Read regex pattern from file

## Configuration Files

### repositories.json
Stores the list of repositories and their review status. This file is automatically created and updated by the script.

### regex-pattern.txt
Optional file containing a custom regex pattern for filtering contributors. If not provided, the default pattern `/[\w.-]+gitlab\.com/i` is used.

## Output Files

- `repositories.json`: List of repositories and their review status
- `unique-contributors.txt`: List of unique contributors
- `unique-contributors-others.txt`: List of contributors matching the regex pattern
- `committers-per-repo.txt`: Detailed breakdown of committers per repository
- `repos/*-contributors.csv`: Individual repository commit data

## Error Handling

The script includes robust error handling with:
- Automatic retry mechanism for failed requests
- Detailed error messages and stack traces
- Graceful handling of rate limits
- Proper cleanup on exit

## Rate Limiting

The script implements rate limiting to prevent API abuse:
- Default limit of 30 requests per minute
- Automatic delay between requests
- Progress tracking for long-running operations

## Requirements

- Node.js
- GitLab Personal Access Token with appropriate permissions:
  - `read_api` scope for repository and commit access
  - `read_repository` scope for repository access

## Troubleshooting

If you encounter issues:

1. Verify your GitLab token has the correct permissions
2. Check your network connection
3. Try using the `--force-refresh` option to clear cached data
4. Ensure the GitLab host URL is correct and accessible
5. Check the error messages for specific details about the failure 