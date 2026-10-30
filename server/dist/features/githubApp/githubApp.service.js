// githubApp.service.ts
import { Octokit } from '@octokit/rest';
import { getInstallationToken } from './githubApp.auth.js';
export async function getUserRepos(installationId) {
    const token = await getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });
    // Retrieve a list of repositories accessible to the authenticated user
    const repos = await octokit.apps.listReposAccessibleToInstallation();
    // Alternatively, retrieve a list of repositories accessible to a GitHub App installation
    // const repos = await octokit.apps.listRepos();
    return repos.data;
}
/*Options to filter by private repo, or to paginate in the case of more than 30 repos
//we can also put filters by name of repo
//const filtered = allRepos.filter(
//(repo) => repo.private && repo.language === 'TypeScript'
//);

//Paginate:
//const response = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
//per_page: 100,
//});
*/
