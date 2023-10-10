const { typescript, javascript, github } = require("projen");

const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "dev",
  name: "cdkv2-dynamodb-seeder",
  releaseToNpm: true,
  workflowContainerImage: "jsii/superchain:1-buster-slim-node18",
  packageManager: javascript.NodePackageManager.NPM,
  gitignore: [".DS_Store"],
  majorVersion: 1,
  tsconfigDevFile: "tsconfig.eslint.json",
  tsconfig: {
    compilerOptions: {
      strictPropertyInitialization: false,
      useUnknownInCatchVariables: false
    }
  },
  depsUpgrade: false,
  github: true,
  githubRelease: false,
  githubOptions: {
    pullRequestLint: false,
    mergify: true,
    mergifyOptions: {
      rules: [
        {
          name: "Automatic merge on approval and successful build",
          conditions: ["#approved-reviews-by>=1", "-label~=(do-not-merge)", "status-success=build"],
          actions: {
            merge: {
              method: "squash",
              commit_message: "title+body",
              strict: "smart",
              strict_method: "merge"
            },
            delete_head_branch: {}
          }
        }
      ]
    }
  },
  buildWorkflow: false,
  minNodeVersion: "18.16.0",
  workflowNodeVersion: "18.16.0",
  jsiiReleaseVersion: "~5.0.0",
  stale: true,
  eslintOptions: {
    prettier: true
  },
  devDeps: [
    "aws-cdk-lib@2.96.0",
    "@types/lodash.chunk@4.2.7",
    "aws-sdk",
    "custom-resource-helper",
    "jest-cdk-snapshot",
    "lodash.chunk@4.2.0",
    "aws-lambda",
    "@types/aws-lambda"
  ],
  deps: ["aws-cdk-lib@2.96.0", "aws-cdk@2.96.0", "constructs@10.0.5", "aws-lambda"]
});

// removing projen default release and build workflows
project.tryRemoveFile("./.github/workflows/release.yml");
project.tryRemoveFile("./.github/workflows/build.yml");

// update build workflow
const githubBuildWorkflow = new github.GithubWorkflow(project.github, "build");

githubBuildWorkflow.on({
  pullRequest: {},
  workflowDispatch: {}
});
githubBuildWorkflow.addJob("build", {
  runsOn: "ubuntu-latest",
  permissions: {
    checks: "write",
    contents: "write"
  },
  env: {
    CI: "true"
  },
  steps: [
    {
      name: "Checkout",
      uses: "actions/checkout@v3",
      with: {
        ref: "${{ github.event.pull_request.head.ref }}",
        repository: "${{ github.event.pull_request.head.repo.full_name }}"
      }
    },
    { name: "Setup Node.js", uses: "actions/setup-node@v3", with: { ["node-version"]: "18.16.0" } },
    {
      name: "Set git identity",
      run: 'git config user.name "Automation"\ngit config user.email "github-actions@github.com"'
    },
    {
      name: "Install dependencies",
      run: "npm ci"
    },
    {
      name: "build",
      run: "npx projen build"
    },
    {
      name: "Check for changes",
      id: "git_diff",
      run: 'git diff --exit-code || echo "::set-output name=has_changes::true"'
    },
    {
      if: "steps.git_diff.outputs.has_changes",
      name: "Commit and push changes (if changed)",
      run: 'git add . && git commit -m "chore: self mutation" && git push origin HEAD:${{ github.event.pull_request.head.ref }}'
    },
    {
      if: "steps.git_diff.outputs.has_changes",
      name: "Update status check (if changed)",
      run: 'gh api -X POST /repos/${{ github.event.pull_request.head.repo.full_name }}/check-runs -F name="build" -F head_sha="$(git rev-parse HEAD)" -F status="completed" -F conclusion="success"',
      env: {
        GITHUB_TOKEN: "${{ secrets.TOKEN_GITHUB }}"
      }
    },
    {
      if: "steps.git_diff.outputs.has_changes",
      name: "Fail check if self mutation happened",
      run: 'echo "Self-mutation happened on this pull request, so this commit is marked as having failed checks."\necho "The self-mutation commit has been marked as successful, and no further action should be necessary."\nexit 1'
    }
  ],
  container: {
    image: "jsii/superchain:1-buster-slim-node18"
  }
});

// update release workflow
const githubReleaseWorkflow = new github.GithubWorkflow(project.github, "release", { force: true });

githubReleaseWorkflow.on({
  push: {
    branches: ["dev"]
  },
  workflow_dispatch: {}
});

githubReleaseWorkflow.addJob("release", {
  runsOn: "ubuntu-latest",
  permissions: {
    contents: "write"
  },
  env: {
    CI: "true"
  },
  steps: [
    {
      name: "Checkout",
      uses: "actions/checkout@v3",
      with: {
        "fetch-depth": 0
      }
    },
    {
      name: "Set git identity",
      run: 'git config user.name "Automation"\ngit config user.email "github-actions@github.com"'
    },
    {
      name: "Setup Node.js",
      uses: "actions/setup-node@v3",
      with: { "node-version": "18.16.0" }
    },
    {
      name: "Install dependencies",
      run: "npm ci"
    },
    {
      name: "release",
      run: "npx projen test && npx run build"
    },
    {
      name: "Check for new commits",
      id: "git_remote",
      run: 'echo ::set-output name=latest_commit::"$(git ls-remote origin -h ${{ github.ref }} | cut -f1)"'
    },
    {
      name: "Create release",
      if: "${{ steps.git_remote.outputs.latest_commit == github.sha }}",
      run: "gh release create v$(cat dist/version.txt) -F dist/changelog.md -t v$(cat dist/version.txt)",
      env: {
        GITHUB_TOKEN: "${{ secrets.TOKEN_GITHUB }}"
      }
    },
    {
      name: "Upload artifact",
      if: "${{ steps.git_remote.outputs.latest_commit == github.sha }}",
      uses: "actions/upload-artifact@v3",
      with: {
        name: "dist",
        path: "dist"
      }
    }
  ],
  container: {
    image: "jsii/superchain:1-buster-slim-node18"
  }
});

githubReleaseWorkflow.addJob("release_npm", {
  runsOn: "ubuntu-latest",
  name: "Release to npm",
  needs: "release",
  permissions: {
    contents: "read"
  },
  steps: [
    {
      uses: "actions/setup-node@v3",
      with: { "node-version": "18.16.0" }
    },
    {
      name: "Download build artifacts",
      uses: "actions/download-artifact@v3",
      with: {
        name: "dist",
        path: "dist"
      }
    },
    {
      name: "Release",
      run: "npx -p jsii-release@latest jsii-release-npm",
      env: {
        NPM_DIST_TAG: "latest",
        NPM_REGISTRY: "registry.npmjs.org",
        NPM_TOKEN: "${{ secrets.NPM_TOKEN }}"
      }
    }
  ],
  container: {
    image: "jsii/superchain:1-buster-slim-node18"
  }
});

project.synth();
