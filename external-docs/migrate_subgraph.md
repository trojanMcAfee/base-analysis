[Goldsky home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/goldsky-38/images/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/goldsky-38/images/logo/dark.png)](https://docs.goldsky.com/)

Search or ask...

Ctrl K

Search...

Navigation

Subgraphs

Migrate from The Graph or another host

[Documentation](https://docs.goldsky.com/introduction) [Subgraphs](https://docs.goldsky.com/subgraphs/introduction) [Mirror](https://docs.goldsky.com/mirror/introduction) [Reference](https://docs.goldsky.com/reference/config-file/pipeline) [Chains](https://docs.goldsky.com/chains/index)

Goldsky provides a one-step migration for your subgraphs on The Graph’s hosted service / decentralized network, or other subgraph host (including your own graph-node). This is a **drop-in replacement** with the following benefits:

- The same subgraph API that your apps already use, allowing for seamless, zero-downtime migration
- A load-balanced network of third-party and on-prem RPC nodes to improve performance and reliability
- Tagging and versioning to hotswap subgraphs, allowing for seamless updates on your frontend
- Alerts and auto-recovery in case of subgraph data consistency issues due to corruption from re-orgs or other issues
- A world-class team who monitors your subgraphs 24/7, with on-call engineering support to help troubleshoot any issues

## [​](https://docs.goldsky.com/subgraphs/migrate-from-the-graph\#migrate-subgraphs-to-goldsky)  Migrate subgraphs to Goldsky

Install Goldsky's CLI and log in

1. Install the Goldsky CLI:





Copy









```shell
curl https://goldsky.com | sh

```

2. Go to your [Project Settings](https://app.goldsky.com/dashboard/settings) page and create an API key.
3. Back in your Goldsky CLI, log into your Project by running the command `goldsky login` and paste your API key.
4. Now that you are logged in, run `goldsky` to get started:





Copy









```shell
goldsky

```


If you have subgraphs deployed to The Graph’s hosted service, the following command seamlessly migrates your subgraph to Goldsky:

Copy

```bash
goldsky subgraph deploy your-subgraph-name/your-version --from-url <your-subgraph-query-url>

```

If you have subgraphs deployed to The Graph’s decentralized network, use the IPFS hash instead (visible on The Graph’s Explorer page for the specified subgraph):

Copy

```bash
goldsky subgraph deploy your-subgraph-name/your-version --from-ipfs-hash <your-subgraph-ipfs-hash>

```

You can get this IPFS deployment hash by querying any subgraph GraphQL endpoint with the following query:

Copy

```GraphQL
query {
  _meta {
    deployment
  }
}

```

## [​](https://docs.goldsky.com/subgraphs/migrate-from-the-graph\#monitor-indexing-progress)  Monitor indexing progress

Once you started the migration with the above command, you can monitor your subgraph’s indexing status with:

Copy

```bash
goldsky subgraph list

```

Alternatively, navigate to [app.goldsky.com](https://app.goldsky.com/) to see your subgraphs, their indexing progress, and more.

Was this page helpful?

YesNo

[Suggest edits](https://github.com/goldsky-io/docs/edit/main/subgraphs/migrate-from-the-graph.mdx) [Raise issue](https://github.com/goldsky-io/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/subgraphs/migrate-from-the-graph)

[Deploy a subgraph](https://docs.goldsky.com/subgraphs/deploying-subgraphs) [Subgraph Webhooks](https://docs.goldsky.com/subgraphs/webhooks)

On this page

- [Migrate subgraphs to Goldsky](https://docs.goldsky.com/subgraphs/migrate-from-the-graph#migrate-subgraphs-to-goldsky)
- [Monitor indexing progress](https://docs.goldsky.com/subgraphs/migrate-from-the-graph#monitor-indexing-progress)