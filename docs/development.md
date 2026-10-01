# Développement et tests

[← README](../README.md)

## Scripts npm

| Script              | Rôle                                                           |
| ------------------- | -------------------------------------------------------------- |
| `start:dev`         | Serveur local avec rechargement à chaud                        |
| `build` / `start`   | Compilation (`dist/`) puis lancement du build                  |
| `test`              | Tests unitaires                                                |
| `test:cov`          | Tests unitaires avec couverture et seuils (90 %)               |
| `test:e2e`          | Tests end-to-end (supertest et handler Lambda)                 |
| `test:int`          | Tests d'intégration contre DynamoDB Local                      |
| `test:infra`        | Tests de la stack CDK (assertions et snapshot)                 |
| `test:smoke`        | Scénarios HTTP contre une API lancée (`BASE_URL`, `API_KEY`)   |
| `lint` / `lint:fix` | ESLint (règles type-aware) et Prettier                         |
| `format:check`      | Vérification du formatage                                      |
| `typecheck`         | `tsc --noEmit` sur l'application et sur l'infra                |
| `db:migrate`        | Applique les migrations en attente à `PLAYERS_TABLE_NAME`      |
| `cdk:synth`         | Build puis synthèse du template CloudFormation (bundle inclus) |
| `cdk:diff`          | Différentiel avec la stack déployée                            |
| `cdk:deploy`        | Build puis déploiement                                         |

Les trois scripts `cdk:*` exigent la variable `API_KEY`, dans le shell ou dans `.env` (voir [Clé d'API](deployment.md#clé-dapi)).

## DynamoDB Local

```bash
docker compose up -d dynamodb                       # DynamoDB Local sur le port 8000
export DYNAMODB_ENDPOINT=http://localhost:8000 PLAYERS_TABLE_NAME=tennis-players-local
npm run db:migrate                                  # crée la table (en local uniquement) et applique les migrations
npm run start:dev                                   # l'API lit et écrit désormais dans DynamoDB
```

Le log de démarrage indique le repository utilisé (`Player repository: DynamoDbPlayerRepository`). On peut aussi brancher le serveur local sur la table déployée : `PLAYERS_TABLE_NAME=<output TableName> AWS_PROFILE=<profil> npm run start:dev`.

## Docker

```bash
docker build -t tennis-players-api .
docker run --rm -p 3000:3000 -e API_KEY=dev-api-key-0123456789 tennis-players-api
```

## Tests et qualité

```bash
npm run test:cov     # 182 tests unitaires, couverture 100 % lignes / 93 % branches, seuils à 90 %
npm run test:e2e     # 43 tests e2e
npm run test:int     # 14 tests d'intégration (DynamoDB Local requis, voir ci-dessous)
npm run test:infra   # 18 tests CDK
npm run test:smoke   # ~100 scénarios HTTP boîte noire contre une API lancée (locale ou déployée)
```

| Niveau      | Périmètre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitaire    | Fonctions statistiques (médiane paire/impaire, liste vide, IMC, ratio cumulé, égalités, arrondi), services, mappers, repositories (DynamoDB via `aws-sdk-client-mock` : index utilisé, expressions, pagination), runner de migrations et migrations, écriture par lots, compteur d'ids, guard de clé d'API (clé absente, fausse, non configurée), DTO de création, filtre d'exception (HttpException, validation, exceptions domaine, 500 sans fuite), pipe, DTO de query, controllers, configuration |
| End-to-end  | Application Nest complète via supertest : tous les endpoints, 200 / 201 / 400 / 401 / 404 / 500, format d'erreur, filtres, Swagger. Pour le `POST` : en-tête `Location`, joueur relisible, présence dans le classement et dans les statistiques, aucune création en cas d'erreur. Le handler Lambda est invoqué avec un vrai événement HTTP API v2, et la réutilisation de l'instance entre invocations est vérifiée                                                                                  |
| Intégration | Contre un vrai **DynamoDB Local** : migrations (application, puis non-réapplication), requêtes sur chaque index, filtres, pagination, créations concurrentes (ids uniques), et l'API complète branchée sur DynamoDB, `POST` compris. Un mock ne peut pas valider une `KeyConditionExpression` : ces tests le font                                                                                                                                                                                     |
| Infra       | Stack CDK : table et GSI, custom resource de migration, droits IAM (écritures de l'API limitées par `LeadingKeys`, aucune suppression), clé d'API, runtime, intégration proxy, throttling, access logs, rétention, outputs et snapshot du template                                                                                                                                                                                                                                                    |

Les tests d'intégration nécessitent DynamoDB Local :

```bash
docker compose up -d dynamodb
DYNAMODB_ENDPOINT=http://localhost:8000 npm run test:int
```

Sans `DYNAMODB_ENDPOINT`, ils sont sautés avec un message explicite. La CI les exécute toujours, avec DynamoDB Local en service container.

### Smoke tests (boîte noire)

`scripts/smoke-test.mjs` rejoue environ 100 scénarios HTTP contre **n'importe quelle instance** de l'API, sans connaître son code :

- chaque endpoint et chaque filtre ;
- tous les cas `400`, `401`, `404` et `413` ;
- le format d'erreur, Swagger et des lectures concurrentes.

Il recalcule lui-même les statistiques à partir de la liste des joueurs pour les comparer à `/stats`.

```bash
# API locale, avec créations (10 créations concurrentes comprises)
BASE_URL=http://localhost:3000 API_KEY=$API_KEY ALLOW_WRITES=1 npm run test:smoke

# API déployée, en lecture seule : les écritures tentées sont toutes rejetées, ce que le script vérifie
BASE_URL=<ApiUrl> API_KEY=$API_KEY npm run test:smoke
```

Après un `npm run cdk:deploy`, le lancer en lecture seule sur l'URL déployée permet de vérifier le déploiement de bout en bout.

**Qualité** : TypeScript `strict` (avec `noUncheckedIndexedAccess`, `noImplicitOverride`…), ESLint avec les règles `recommendedTypeChecked` de typescript-eslint, et Prettier. Tout est vérifié en CI.
