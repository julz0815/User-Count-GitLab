import { promises as fs } from 'fs';


const host = "https://gitlab.com";
const token = "YOUR TOKEN HERE";
const maxRequestsPerMinute = 30; // Set your desired limit here


// Function to fetch all repositories for a given organization with throttling
async function getAllRepositoriesWithThrottle(maxRequestsPerMinute: number) {
  const repositories: any[] = [];
  const perPage = 100;
  let page = 1;
  const maxRequestsPerSecond = maxRequestsPerMinute / 60;
  let remainingRequests = maxRequestsPerMinute;

  
  while (true) {
    const startTime = Date.now();

    const response = await fetch(`${host}/api/v4/projects?membership=true&per_page=${perPage}&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Error fetching repositories:', response.statusText);
      break;
    }

    const data = await response.json();

    if (data.length === 0) break;
  

    for ( let i=0 ; i<data.length ; i++){
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      remainingRequests = maxRequestsPerMinute;
    }
    console.log("Fetched repositories - page "+ page);
    page++;
  }
  return repositories;
}

// Function to find all contributing users for a repository within the last 90 days
async function getContributors(repo_id: string, repo_name: string) {
  console.log('-Fetching commits for '+repo_name)
  // Get the date 90 days ago from now
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Format the date as required by the GitLab API (ISO 8601)
  const sinceDate = ninetyDaysAgo.toISOString();

  // Initialize an empty array to store all contributors
  let allContributors:any = [];

  // Initialize page number
  let page = 1;

  while (true) {
    // Fetch commits since the specified date
    let response: any;
    try {
      response = await fetch(`${host}/api/v4/projects/${encodeURIComponent(repo_id)}/repository/commits?since=${sinceDate}&page=${page}&per_page=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
  
      if (!response.ok) {
        console.error('Error fetching commits:', response.statusText);
        break;
      }
  
      const data = await response.json();
      if (data.length === 0){ 
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
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return allContributors;
}

// Function to write contributors to a CSV file
async function writeContributorsToCSV(repo:any,contributors:any) {
  const filePath = 'repos/'+repo+'-contributors.csv';
  var csvContent = JSON.stringify(contributors);
  await fs.writeFile(filePath, csvContent, 'utf8');
  console.log(`---Commits have been written to ${filePath}\n`);
}

async function storeReposToFile(repositories: any[], filePath: string) {
  const data = JSON.stringify(repositories, null, 2); // Convert to JSON with pretty print
  await fs.writeFile(filePath, data, 'utf8');
  console.log(`Repositories have been written to ${filePath}`);
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllUsers (){

  let repositories:any = [];

  //check if the file repsitories.json exist
  const repositoriesExist = await fs.access('repositories.json')
    .then(() => true)
    .catch(() => false);

  if (repositoriesExist) {
    console.log('File repositories.json exists - mo need to fetch again');
    const data = await fs.readFile('repositories.json', 'utf8');
    repositories = JSON.parse(data);
  } else {
    repositories = await getAllRepositoriesWithThrottle(maxRequestsPerMinute);
    storeReposToFile(repositories, 'repositories.json')
  }

  //fetch contributors per repo
  const numberOfRepos = repositories.length
  console.log(numberOfRepos+' repositories fetched')
  for (const repo of repositories) {
    //wait 3 seconds before the next request to throttle
    await wait(3000);
    console.log('Fetching contributors for '+repo.name)
    const contributorFilesExist = await fs.access('repos/'+repo.name+'-contributors.csv')
    .then(() => true)
    .catch(() => false);

    if (contributorFilesExist){
      console.log('Commits file for '+repo.name+' exists - no need to fetch again');
    }
    else {
      const contributors = await getContributors(repo.id, repo.name);
      const numberOfContributors = contributors.length
      console.log('--Commits for '+repo.name+': '+numberOfContributors)
      await writeContributorsToCSV(repo.name,contributors);
    }
  }


  // Read all contributor files and consolidate to unique contributors
  const uniqueContributors: Set<string> = new Set();
  const uniqueContributorsOthers: Set<string> = new Set();
  for (const repo of repositories) {
    const contributorFilePath = `repos/${repo.name}-contributors.csv`;
    const contributorFileExists = await fs.access(contributorFilePath)
      .then(() => true)
      .catch(() => false);
    if (contributorFileExists) {
      const contributorFileContent = await fs.readFile(contributorFilePath, 'utf8');
      const contributors = JSON.parse(contributorFileContent);
      const countFromFile = contributors.length
      console.log('Contributors for '+repo.name+': '+countFromFile)
      if (countFromFile > 0){
        for ( let i=0 ; i<countFromFile ; i++){
          const pattern = /[\w.-]+gitlab\.com/i;
          if ( pattern.test(contributors[i].author_email) ) {
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
  const contrinutorsArray = Array.from(uniqueContributors)
  const contributorsCount = contrinutorsArray.length
  const contributorsContent = 'Total number of unique contributors in the last 90 days: '+contributorsCount+'\n'+contrinutorsArray.join('\n');
  await fs.writeFile(contributorsFilePath, contributorsContent);
  console.log(`Unique contributors have been written to ${contributorsFilePath}`);

  const contributorsFilePathOthers = 'unique-contributors-others.txt';
  const contrinutorsArrayOthers = Array.from(uniqueContributorsOthers)
  const contributorsCountOthers = contrinutorsArrayOthers.length
  const contributorsContentOthers = 'Total number of unique contributors in the last 90 days: '+contributorsCountOthers+'\n'+contrinutorsArrayOthers.join('\n');
  await fs.writeFile(contributorsFilePathOthers, contributorsContentOthers);
  console.log(`Unique contributors have been written to ${contributorsFilePathOthers}`);



}

getAllUsers()