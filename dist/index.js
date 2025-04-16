/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 925:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs_1 = __nccwpck_require__(147);
const readline = __importStar(__nccwpck_require__(521));
// Parse command line arguments
const args = process.argv.slice(2);
const token = args[0];
let host = 'https://gitlab.com'; // Default to gitlab.com
let forceRefresh = false;
let interactive = false;
let regexPattern = '/gitlab\\.com$/i';
let regexFile;
const maxRequestsPerMinute = 30;
// Parse additional arguments
for (let i = 1; i < args.length; i++) {
    if (args[i] === '--force-refresh') {
        forceRefresh = true;
    }
    else if (args[i] === '--interactive') {
        interactive = true;
    }
    else if (args[i] === '--regex' && i + 1 < args.length) {
        regexPattern = args[++i];
    }
    else if (args[i] === '--regex-file' && i + 1 < args.length) {
        regexFile = args[++i];
    }
    else if (!args[i].startsWith('--')) {
        // If it's not a flag, it's the host
        host = args[i];
    }
}
// Validate host
if (!host.startsWith('https://')) {
    console.error('Error: Host must start with https://');
    process.exit(1);
}
if (!token) {
    console.error('Error: Please provide a GitLab personal access token.');
    console.error('Usage: ts-node src/index.ts <token> [host] [options]');
    console.error('Options:');
    console.error('  --force-refresh    Force refresh of repositories');
    console.error('  --interactive     Enable interactive repository selection');
    console.error('  --regex <pattern> Use custom regex pattern for email categorization');
    console.error('  --regex-file <file> Read regex pattern from file');
    process.exit(1);
}
// Create readline interface for interactive mode
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
// Function to prompt user for input
const question = (query) => {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
};
// Function to get regex pattern
async function getRegexPattern() {
    if (regexFile) {
        try {
            const pattern = await fs_1.promises.readFile(regexFile, 'utf8');
            return new RegExp(pattern.trim());
        }
        catch (error) {
            console.error(`Error reading regex file: ${error}`);
            process.exit(1);
        }
    }
    // Handle regex pattern with flags
    const match = regexPattern.match(/^\/(.*)\/([a-z]*)$/);
    if (match) {
        const [, pattern, flags] = match;
        console.log(`Using regex pattern: ${pattern} with flags: ${flags}`);
        return new RegExp(pattern, flags);
    }
    // If no slashes, treat as a simple pattern
    console.log(`Using simple pattern: ${regexPattern}`);
    return new RegExp(regexPattern, 'i');
}
// Function to fetch all repositories with throttling
async function getAllRepositoriesWithThrottle(maxRequestsPerMinute) {
    const repositories = [];
    const perPage = 100;
    let page = 1;
    const maxRequestsPerSecond = maxRequestsPerMinute / 60;
    let remainingRequests = maxRequestsPerMinute;
    let totalRepos = 0;
    let retryCount = 0;
    const maxRetries = 3;
    try {
        while (true) {
            const startTime = Date.now();
            try {
                console.log(`Fetching repositories page ${page}...`);
                console.log(`Using API endpoint: ${host}`);
                const response = await fetch(`${host}/api/v4/projects?membership=true&per_page=${perPage}&page=${page}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    if (response.status === 401) {
                        console.error('Error: Invalid GitLab token. Please verify your token is correct and has the necessary permissions.');
                        process.exit(1);
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.length === 0) {
                    console.log('No more repositories found');
                    break;
                }
                const newRepos = data.map((repo) => ({
                    name: repo.name,
                    path_with_namespace: repo.path_with_namespace,
                    id: repo.id,
                    shouldReview: true
                }));
                repositories.push(...newRepos);
                totalRepos += newRepos.length;
                remainingRequests--;
                retryCount = 0; // Reset retry count on successful request
                if (remainingRequests === 0) {
                    const elapsedTime = Date.now() - startTime;
                    const delay = Math.ceil(1000 / maxRequestsPerSecond) - elapsedTime;
                    if (delay > 0) {
                        console.log(`Rate limit reached, waiting ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    remainingRequests = maxRequestsPerMinute;
                }
                console.log(`Fetched ${totalRepos} repositories (page ${page})`);
                page++;
            }
            catch (error) {
                console.error('Full error details:', error);
                if (error instanceof Error) {
                    console.error(`Error fetching repositories (page ${page}): ${error.message}`);
                    console.error('Error stack:', error.stack);
                    if (error.message.includes('timeout') || error.message.includes('connect')) {
                        retryCount++;
                        if (retryCount <= maxRetries) {
                            console.log(`Connection timeout, retrying (${retryCount}/${maxRetries})...`);
                            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
                            continue;
                        }
                        else {
                            console.error('Max retries reached. Please check your network connection and try again.');
                            throw error;
                        }
                    }
                }
                else {
                    console.error('Unknown error type:', error);
                }
                throw error;
            }
        }
    }
    catch (error) {
        console.error(`Error in getAllRepositoriesWithThrottle: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (error instanceof Error) {
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
    if (totalRepos === 0) {
        console.log('No repositories found. Please verify your token has the necessary permissions.');
    }
    return repositories;
}
// Function to find all contributing users for a repository within the last 90 days
async function getContributors(repo_id, repo_name) {
    console.log(`-Fetching commits for ${repo_name}`);
    // Get the date 90 days ago from now
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    // Format the date as required by the GitLab API (ISO 8601)
    const sinceDate = ninetyDaysAgo.toISOString();
    // Initialize an empty array to store all contributors
    let allContributors = [];
    // Initialize page number
    let page = 1;
    let retryCount = 0;
    const maxRetries = 3;
    while (true) {
        try {
            const response = await fetch(`${host}/api/v4/projects/${encodeURIComponent(repo_id)}/repository/commits?since=${sinceDate}&page=${page}&per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Error: Invalid GitLab token. Please verify your token is correct and has the necessary permissions.');
                    process.exit(1);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.length === 0) {
                break;
            }
            allContributors = allContributors.concat(data);
            page++;
            // Delay between requests to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (error) {
            console.error(`Error fetching commits for ${repo_name}:`, error);
            retryCount++;
            if (retryCount <= maxRetries) {
                console.log(`Retrying (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            else {
                console.error('Max retries reached. Moving to next repository.');
                break;
            }
        }
    }
    return allContributors;
}
// Function to write contributors to a CSV file
async function writeContributorsToCSV(repo, contributors) {
    const filePath = `repos/${repo}-contributors.csv`;
    const csvContent = JSON.stringify(contributors);
    await fs_1.promises.writeFile(filePath, csvContent, 'utf8');
    console.log(`---Commits have been written to ${filePath}\n`);
}
// Function to store repositories to a file
async function storeReposToFile(repositories, filePath) {
    const data = JSON.stringify(repositories, null, 2);
    await fs_1.promises.writeFile(filePath, data, 'utf8');
    console.log(`Repositories have been written to ${filePath}`);
}
// Function to wait for a specified time
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Function to delete cached commit files
async function deleteCachedCommitFiles() {
    try {
        const files = await fs_1.promises.readdir('repos');
        for (const file of files) {
            if (file.endsWith('-contributors.csv')) {
                await fs_1.promises.unlink(`repos/${file}`);
                console.log(`Deleted cached file: ${file}`);
            }
        }
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error deleting cached files:', error);
        }
    }
}
// Function to write committers per repository
async function writeCommittersPerRepo(committers) {
    const filePath = 'committers-per-repo.txt';
    let content = '';
    for (const [repo, emails] of committers) {
        content += `Repository: ${repo}\n`;
        content += `Number of committers: ${emails.size}\n`;
        content += 'Committers:\n';
        for (const email of emails) {
            content += `  ${email}\n`;
        }
        content += '\n';
    }
    await fs_1.promises.writeFile(filePath, content, 'utf8');
    console.log(`Committers per repository have been written to ${filePath}`);
}
// Main function to get all users
async function getAllUsers() {
    try {
        let repositories = [];
        let regexPattern;
        // Try to read regex pattern from file if it exists
        try {
            const regexContent = await fs_1.promises.readFile('regex-pattern.txt', 'utf8');
            regexPattern = new RegExp(regexContent.trim());
        }
        catch {
            // Default regex pattern if file doesn't exist
            regexPattern = /[\w.-]+gitlab\.com/i;
        }
        // Check if repositories.json exists and force refresh is not enabled
        const repositoriesExist = await fs_1.promises.access('repositories.json')
            .then(() => true)
            .catch(() => false);
        if (repositoriesExist && !forceRefresh) {
            console.log('File repositories.json exists - no need to fetch again');
            const data = await fs_1.promises.readFile('repositories.json', 'utf8');
            repositories = JSON.parse(data);
        }
        else {
            repositories = await getAllRepositoriesWithThrottle(maxRequestsPerMinute);
            await storeReposToFile(repositories, 'repositories.json');
        }
        // If in interactive mode, prompt for each repository
        if (interactive) {
            for (const repo of repositories) {
                const answer = await question(`Do you want to review repository "${repo.name}"? (y/n): `);
                repo.shouldReview = answer.toLowerCase() === 'y';
            }
            // Save updated repositories with review decisions
            await storeReposToFile(repositories, 'repositories.json');
        }
        // Delete cached commit files if force refresh is enabled
        if (forceRefresh) {
            await deleteCachedCommitFiles();
        }
        // Fetch contributors per repo
        const numberOfRepos = repositories.length;
        console.log(`${numberOfRepos} repositories fetched`);
        const committersPerRepo = new Map();
        for (const repo of repositories) {
            if (!repo.shouldReview)
                continue;
            await wait(3000); // Wait 3 seconds between requests
            console.log(`Fetching contributors for ${repo.name}`);
            const contributorFilesExist = await fs_1.promises.access(`repos/${repo.name}-contributors.csv`)
                .then(() => true)
                .catch(() => false);
            if (contributorFilesExist && !forceRefresh) {
                console.log(`Commits file for ${repo.name} exists - no need to fetch again`);
                const contributorFileContent = await fs_1.promises.readFile(`repos/${repo.name}-contributors.csv`, 'utf8');
                const contributors = JSON.parse(contributorFileContent);
                const committers = new Set();
                for (const contributor of contributors) {
                    committers.add(contributor.author_email);
                }
                committersPerRepo.set(repo.name, committers);
            }
            else {
                const contributors = await getContributors(repo.id, repo.name);
                const numberOfContributors = contributors.length;
                console.log(`--Commits for ${repo.name}: ${numberOfContributors}`);
                await writeContributorsToCSV(repo.name, contributors);
                const committers = new Set();
                for (const contributor of contributors) {
                    committers.add(contributor.author_email);
                }
                committersPerRepo.set(repo.name, committers);
            }
        }
        // Write committers per repository
        await writeCommittersPerRepo(committersPerRepo);
        // Read all contributor files and consolidate to unique contributors
        const uniqueContributors = new Set();
        const uniqueContributorsOthers = new Set();
        for (const [repo, committers] of committersPerRepo) {
            console.log(`Processing contributors for ${repo}: ${committers.size}`);
            for (const email of committers) {
                if (regexPattern.test(email)) {
                    uniqueContributorsOthers.add(email);
                }
                else {
                    uniqueContributors.add(email);
                }
            }
        }
        // Save unique contributors to files
        const contributorsFilePath = 'unique-contributors.txt';
        const contributorsArray = Array.from(uniqueContributors);
        const contributorsCount = contributorsArray.length;
        const contributorsContent = `Total number of unique contributors in the last 90 days: ${contributorsCount}\n${contributorsArray.join('\n')}`;
        await fs_1.promises.writeFile(contributorsFilePath, contributorsContent);
        console.log(`Unique contributors have been written to ${contributorsFilePath}`);
        const contributorsFilePathOthers = 'unique-contributors-others.txt';
        const contributorsArrayOthers = Array.from(uniqueContributorsOthers);
        const contributorsCountOthers = contributorsArrayOthers.length;
        const contributorsContentOthers = `Total number of unique contributors in the last 90 days: ${contributorsCountOthers}\n${contributorsArrayOthers.join('\n')}`;
        await fs_1.promises.writeFile(contributorsFilePathOthers, contributorsContentOthers);
        console.log(`Unique contributors have been written to ${contributorsFilePathOthers}`);
        // Close readline interface and exit
        rl.close();
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        rl.close();
        process.exit(1);
    }
}
// Remove the separate rl.on('close') handler since we're handling it in getAllUsers
getAllUsers();


/***/ }),

/***/ 147:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 521:
/***/ ((module) => {

module.exports = require("readline");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(925);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;