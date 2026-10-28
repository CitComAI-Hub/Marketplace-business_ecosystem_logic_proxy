# Business Ecosystem Logic Proxy Docker Image

This repository contains the Docker image of the Business Ecosystem Logic Proxy component of the FIWARE Business API Ecosystem GE.

You can build a docker image based on this Dockerfile. This image will contain only an instance of the Business Ecosystem Logic Proxy, exposing port `8004`. This requires that you have [docker](https://docs.docker.com/installation/) installed on your machine.

The current Business API Ecosystem can use different IDMs to run. In this way, you have to register your instance in the chosen IDM as described in the [Business API Ecosystem configuration guide](https://business-api-ecosystem.readthedocs.io/en/latest/configuration-guide.html#configuring-the-logic-proxy) before running the container since the IdM credentials are required.

If you just want to have a Business Ecosystem Logic Proxy instance running as quickly as possible jump to section *The Fastest Way*.

If you want to know what is behind the scenes of our container you can go ahead and read the build and run sections.

## The Fastest Way

The Business Ecosystem Logic Proxy uses an external MongoDB container as database and an ElasticSearch container for handling indexes.
Both components can be configured providing a `config.js` file or using environment variables. For details of the different configuration options have a look at the
[Business API Ecosystem configuration guide](https://business-api-ecosystem.readthedocs.io/en/latest/configuration-guide.html#configuring-the-logic-proxy)

To run the Business Ecosystem Logic Proxy, `docker compose` can be used. You can use the `docker-compose.yml` file included
with the source of the software, or create a new one with the following content:

```
version: '3'
services:
    elasticsearch:
        image: docker.elastic.co/elasticsearch/elasticsearch:7.5.0
        environment:
            - 'node.name=BAE'
            - 'discovery.type=single-node'
            - 'ES_JAVA_OPTS=-Xms256m -Xmx256m'
        ports:
            - "127.0.0.1:9200:9200"

    mongo:
        image: mongo:4.4
        ports:
            - 27017:27017
        volumes:
            - ./proxy-data:/data/db

    proxy:
        image: fiware/biz-ecosystem-logic-proxy:master
        links:
            - mongo
        depends_on:
            - mongo
        ports:
            - 8000:8000
        volumes:
            - ./proxy-themes:/business-ecosystem-logic-proxy/themes
            - ./proxy-static:/business-ecosystem-logic-proxy/static
        environment:
            - NODE_ENV=development  # Deployment in development or in production
            - COLLECT=True  # Execute the collect static command on startup

            - BAE_LP_PORT=8000  # Port where the node service is going to run in the container
            - BAE_LP_HOST=proxy.docker  # Host where the node service if going to run in the container
            # - BAE_SERVICE_HOST=https://store.lab.fiware.org/  # If provided, this URL specifies the actual URL that is used to access the BAE, when the component is proxied (e.g Apache)
            # - BAE_LP_HTTPS_ENABLED=true  # If provided specifies whether the service is running in HTTPS, default: false
            # - BAE_LP_HTTPS_CERT=cert/cert.crt  # Certificate for the SSL configuration (when HTTPS enabled is true)
            # - BAE_LP_HTTPS_CA=cert/ca.crt  # CA certificate for the SSL configuration (when HTTPS enabled is true)
            # - BAE_LP_HTTPS_KEY=cert/key.key  # Key sfile for the SSL configuration (when HTTPS enabled is true)
            # - BAE_LP_HTTPS_PORT=443  # Port where the service runs when SSL is enabled (when HTTPS enabled is true)

            # ------ OAUTH2 Config ------
            - BAE_LP_OAUTH2_SERVER=http://idm.docker:8000  # URL of the FIWARE IDM used for user authentication
            - BAE_LP_OAUTH2_CLIENT_ID=id  # OAuth2 Client ID of the BAE applicaiton
            - BAE_LP_OAUTH2_CLIENT_SECRET=secret  # OAuth Client Secret of the BAE application
            - BAE_LP_OAUTH2_CALLBACK=http://proxy.docker:8004/auth/fiware/callback  # Callback URL for receiving the access tokens
            - BAE_LP_OAUTH2_ADMIN_ROLE=admin  # Role defined in the IDM client app for admins of the BAE 
            - BAE_LP_OAUTH2_SELLER_ROLE=seller  # Role defined in the IDM client app for sellers of the BAE 
            - BAE_LP_OAUTH2_CUSTOMER_ROLE=customer  # Role defined in the IDM client app for customers of the BAE 
            - BAE_LP_OAUTH2_ORG_ADMIN_ROLE=orgAdmin  # Role defined in the IDM client app for organization admins of the BAE 
            - BAE_LP_OAUTH2_IS_LEGACY=false  # Whether the used FIWARE IDM is version 6 or lower

            # - BAE_LP_THEME=theme  # If provided custom theme to be used by the web site, it must be included in themes volume
            
            # ----- Mongo Config ------
            # - BAE_LP_MONGO_USER=user
            # - BAE_LP_MONGO_PASS=pass
            - BAE_LP_MONGO_SERVER=localhost
            - BAE_LP_MONGO_PORT=27017
            - BAE_LP_MONGO_DB=belp

            - BAE_LP_REVENUE_MODEL=30  # Default market owner precentage for Revenue Sharing models

            # ----- APIs Configuration -----
            # If provided, it supports configuring the contection to the different APIs managed by the logic proxy, by default
            # apis.docker, charging.docker and rss.docker domains are configured
            # - BAE_LP_ENDPOINT_CATALOG_PATH=DSProductCatalog
            # - BAE_LP_ENDPOINT_CATALOG_PORT=8080
            # - BAE_LP_ENDPOINT_CATALOG_HOST=apis.docker
            # - BAE_LP_ENDPOINT_CATALOG_SECURED=false
            # ...
```

The biz-ecosystem-logic-proxy image defines 2 volumes. In particular:
* */business-ecosystem-logic-proxy/themes*: In this volume, it can be provided the themes that can be used to customize the web portal
* */business-ecosystem-logic-proxy/static*: This volume includes the static files ready to be rendered including the selected theme and js files

Additionally, the image defines two environment variables intended to optimize the production deployment of the BAE Logic proxy:
* *NODE_ENV*: Specifies whether the system is in *development* or in *production* (default: development)
* *COLLECT*: Specifies if the container should execute the collect static command to generate static files or use the existing on start up (default: True)

As can be seen in the `docker-compose.yml` file, configuration can be provided as environment variables. If this feature is used,
providing a `config.js` file with the configuration is not necessary, taking into account that the environment values override the file ones.

Once you have created the file, run the following command:

```
docker compose up -d
```

Then, the Business Ecosystem Logic Proxy should be up and running in `http://YOUR_HOST:PORT/` replacing `YOUR_HOST` by the host of your machine and `PORT` by the port selected in the previous step.

Once the different containers are running, you can stop them using:

```
docker compose stop
```

And start them again using:

```
docker compose start
```

Additionally, you can terminate the different containers by executing:

```
docker compose down
```

## Build the image

If you have downloaded the [Business Ecosystem Logic Proxy's source code](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy) you can build your own image. The result will be the same, but this way you have a bit more of control of what's happening.

To create the image, from the project directory:

    docker build -t biz-ecosystem-logic-proxy  -f docker/Dockerfile .

The parameter `-t biz-ecosystem-logic-proxy` gives the image a name. This name could be anything, or even include an organization like `-t fiware/biz-ecosystem-logic-proxy`. This name is later used to run the container based on the image.

---

# Custom image for CITCOM Marketplace

## Automatic image publishing (GitHub Actions)

The image is built and published automatically by the [publish-citcom.yml](../.github/workflows/publish-citcom.yml) workflow. The result is stored in the GitHub registry: [ghcr.io/citcomai-hub/citcom-marketplace](https://github.com/orgs/CitComAI-Hub/packages/container/package/citcom-marketplace).

### How it works

The image depends on two repositories:

- **This repo** (`Marketplace-business_ecosystem_logic_proxy`): the proxy and the `Dockerfile`.
- **[vrain_BAE-Frontend](https://github.com/CitComAI-Hub/vrain_BAE-Frontend)**: the frontend with the CITCOM theme. It has to be compiled and the output copied into `docker/proxy-themes/bae-frontend`, which the `Dockerfile` includes in the image.

When a tag is pushed, the workflow does the following:

1. Checks that the tagged commit belongs to the `feat/citcom` branch. If not, it fails without publishing anything.
2. Clones `vrain_BAE-Frontend` at the **tag with the same name**.
3. Builds the frontend with `docker compose run --rm build-frontend`, which generates `dist/bae-frontend`.
4. Replaces `docker/proxy-themes/bae-frontend` with that output.
5. Builds the image with `docker/Dockerfile` (`linux/amd64` and `linux/arm64`).
6. Publishes it as `ghcr.io/citcomai-hub/citcom-marketplace:<tag>`.

The workflow runs **only** when a tag is created. Pushing to a branch does not publish anything.

### Publishing a new version

1. Push your changes to `feat/citcom` in both repos. Frontend changes must be in its repo before step 2.
2. Create the tag in the **frontend** repo and push it:

   ```bash
   cd vrain_BAE-Frontend
   git tag v1.2.0
   git push origin v1.2.0
   ```

3. Create a tag with the **same name** in this repo, on a commit of `feat/citcom` that has already been pushed, and push it:

   ```bash
   cd Marketplace-business_ecosystem_logic_proxy
   git tag v1.2.0
   git push origin v1.2.0
   ```

4. Follow the run in the *Actions* tab of this repo. When it finishes, the image is available in the registry as `citcom-marketplace:v1.2.0`.

The tag name is the image version. A published tag should never be moved or reused: if something goes wrong, create a new one (e.g. `v1.2.1`).

### Requirements and common problems

- **The frontend tag must exist before the proxy tag.** Otherwise the frontend checkout step fails.
- **Tag not in `feat/citcom`**: the tag points to a commit that is not in `feat/citcom`, or the branch was pushed after the tag.
- **`denied: permission_denied: write_package`**: this repo has no write access to the package. In the package settings (*Manage Actions access*), add this repo with the *Write* role. This is done only once.
- **Private frontend repo**: the automatic `GITHUB_TOKEN` cannot read other repos. Store a token with read access to `vrain_BAE-Frontend` as the `FRONTEND_REPO_TOKEN` secret in this repo or in the organization. It is configured once by one person and works for everyone.
- **Changing the branch or the frontend repo**: they are set in `PROXY_BRANCH` and `FRONTEND_REPO` at the top of the workflow.

### Manual build (without the workflow)

To build the image locally:

```bash
# 1. Build the frontend (in vrain_BAE-Frontend)
docker compose run --rm build-frontend

# 2. Copy the output into this repo
rm -rf docker/proxy-themes/bae-frontend
cp -r ../vrain_BAE-Frontend/dist/bae-frontend docker/proxy-themes/bae-frontend

# 3. Build the image
docker build -t test_citcom-marketplace:v0.3 -f docker/Dockerfile .
```
