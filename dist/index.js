/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 925:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs_1 = __nccwpck_require__(147);
const host = "https://gitlab.com";
const token = "YOUR TOKEN HERE";
const maxRequestsPerMinute = 30; // Set your desired limit here
// Function to fetch all repositories for a given organization with throttling
function getAllRepositoriesWithThrottle(maxRequestsPerMinute) {
    return __awaiter(this, void 0, void 0, function* () {
        const repositories = [];
        const perPage = 100;
        let page = 1;
        const maxRequestsPerSecond = maxRequestsPerMinute / 60;
        let remainingRequests = maxRequestsPerMinute;
        while (true) {
            const startTime = Date.now();
            const response = yield fetch(`${host}/api/v4/projects?membership=true&per_page=${perPage}&page=${page}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                console.error('Error fetching repositories:', response.statusText);
                break;
            }
            const data = yield response.json();
            if (data.length === 0)
                break;
            for (let i = 0; i < data.length; i++) {
                repositories.push({
                    name: data[i].name,
                    path_with_namespace: data[i].path_with_namespace,
                    id: data[i].id
                });
            }
            remainingRequests--;
            if (remainingRequests === 0) {
                const elapsedTime = Date.now() - startTime;
                const delay = Math.ceil(1000 / maxRequestsPerSecond) - elapsedTime;
                if (delay > 0) {
                    yield new Promise(resolve => setTimeout(resolve, delay));
                }
                remainingRequests = maxRequestsPerMinute;
            }
            console.log("Fetched repositories - page " + page);
            page++;
        }
        return repositories;
    });
}
// Function to find all contributing users for a repository within the last 90 days
function getContributors(repo_id, repo_name) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('-Fetching commits for ' + repo_name);
        // Get the date 90 days ago from now
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        // Format the date as required by the GitLab API (ISO 8601)
        const sinceDate = ninetyDaysAgo.toISOString();
        // Initialize an empty array to store all contributors
        let allContributors = [];
        // Initialize page number
        let page = 1;
        while (true) {
            // Fetch commits since the specified date
            let response;
            try {
                response = yield fetch(`${host}/api/v4/projects/${encodeURIComponent(repo_id)}/repository/commits?since=${sinceDate}&page=${page}&per_page=100`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    console.error('Error fetching commits:', response.statusText);
                    break;
                }
                const data = yield response.json();
                if (data.length === 0) {
                    break;
                }
                else {
                    allContributors = allContributors.concat(data);
                    page++;
                }
            }
            catch (error) {
                console.log('-Error fetching contributors for ' + repo_name + ': ' + error);
                break;
            }
            // Delay the next request by 1 second to limit to 60 requests per minute
            yield new Promise(resolve => setTimeout(resolve, 3000));
        }
        return allContributors;
    });
}
// Function to write contributors to a CSV file
function writeContributorsToCSV(repo, contributors) {
    return __awaiter(this, void 0, void 0, function* () {
        const filePath = 'repos/' + repo + '-contributors.csv';
        var csvContent = JSON.stringify(contributors);
        yield fs_1.promises.writeFile(filePath, csvContent, 'utf8');
        console.log(`---Commits have been written to ${filePath}\n`);
    });
}
function storeReposToFile(repositories, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = JSON.stringify(repositories, null, 2); // Convert to JSON with pretty print
        yield fs_1.promises.writeFile(filePath, data, 'utf8');
        console.log(`Repositories have been written to ${filePath}`);
    });
}
function wait(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
function getAllUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        let repositories = [];
        //check if the file repsitories.json exist
        const repositoriesExist = yield fs_1.promises.access('repositories.json')
            .then(() => true)
            .catch(() => false);
        if (repositoriesExist) {
            console.log('File repositories.json exists - mo need to fetch again');
            const data = yield fs_1.promises.readFile('repositories.json', 'utf8');
            repositories = JSON.parse(data);
        }
        else {
            repositories = yield getAllRepositoriesWithThrottle(maxRequestsPerMinute);
            storeReposToFile(repositories, 'repositories.json');
        }
        //fetch contributors per repo
        const numberOfRepos = repositories.length;
        console.log(numberOfRepos + ' repositories fetched');
        for (const repo of repositories) {
            //wait 3 seconds before the next request to throttle
            yield wait(3000);
            console.log('Fetching contributors for ' + repo.name);
            const contributorFilesExist = yield fs_1.promises.access('repos/' + repo.name + '-contributors.csv')
                .then(() => true)
                .catch(() => false);
            if (contributorFilesExist) {
                console.log('Commits file for ' + repo.name + ' exists - no need to fetch again');
            }
            else {
                const contributors = yield getContributors(repo.id, repo.name);
                const numberOfContributors = contributors.length;
                console.log('--Commits for ' + repo.name + ': ' + numberOfContributors);
                yield writeContributorsToCSV(repo.name, contributors);
            }
        }
        // Read all contributor files and consolidate to unique contributors
        const uniqueContributors = new Set();
        const uniqueContributorsOthers = new Set();
        for (const repo of repositories) {
            const contributorFilePath = `repos/${repo.name}-contributors.csv`;
            const contributorFileExists = yield fs_1.promises.access(contributorFilePath)
                .then(() => true)
                .catch(() => false);
            if (contributorFileExists) {
                const contributorFileContent = yield fs_1.promises.readFile(contributorFilePath, 'utf8');
                const contributors = JSON.parse(contributorFileContent);
                const countFromFile = contributors.length;
                console.log('Contributors for ' + repo.name + ': ' + countFromFile);
                if (countFromFile > 0) {
                    for (let i = 0; i < countFromFile; i++) {
                        const pattern = /[\w.-]+gitlab\.com/i;
                        if (pattern.test(contributors[i].author_email)) {
                            uniqueContributorsOthers.add(contributors[i].author_email);
                        }
                        else {
                            uniqueContributors.add(contributors[i].author_email);
                        }
                    }
                }
            }
        }
        // Save unique contributors to a file
        const contributorsFilePath = 'unique-contributors.txt';
        const contrinutorsArray = Array.from(uniqueContributors);
        const contributorsCount = contrinutorsArray.length;
        const contributorsContent = 'Total number of unique contributors in the last 90 days: ' + contributorsCount + '\n' + contrinutorsArray.join('\n');
        yield fs_1.promises.writeFile(contributorsFilePath, contributorsContent);
        console.log(`Unique contributors have been written to ${contributorsFilePath}`);
        const contributorsFilePathOthers = 'unique-contributors-others.txt';
        const contrinutorsArrayOthers = Array.from(uniqueContributorsOthers);
        const contributorsCountOthers = contrinutorsArrayOthers.length;
        const contributorsContentOthers = 'Total number of unique contributors in the last 90 days: ' + contributorsCountOthers + '\n' + contrinutorsArrayOthers.join('\n');
        yield fs_1.promises.writeFile(contributorsFilePathOthers, contributorsContentOthers);
        console.log(`Unique contributors have been written to ${contributorsFilePathOthers}`);
    });
}
getAllUsers();


/***/ }),

/***/ 147:
/***/ ((module) => {

module.exports = require("fs");

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