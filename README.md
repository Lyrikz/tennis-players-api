# Tennis Players API

API REST qui expose des joueurs de tennis et des statistiques sur ces joueurs.

**Stack** : TypeScript, NestJS, DynamoDB. Déploiement serverless sur AWS (Lambda + API Gateway HTTP API) avec AWS CDK.

> **API déployée** : https://ofas5if6ib.execute-api.eu-north-1.amazonaws.com/api/v1
> **Swagger UI** : https://ofas5if6ib.execute-api.eu-north-1.amazonaws.com/docs
>
> Les lectures sont publiques. `POST /players` nécessite une clé d'API (header `x-api-key`), transmise séparément.

| Méthode | Route                 | Description                                                       |
| ------- | --------------------- | ----------------------------------------------------------------- |
| `GET`   | `/api/v1/players`     | Joueurs du meilleur au moins bon. Filtres `?sex=M\|F&country=SRB` |
| `GET`   | `/api/v1/players/:id` | Un joueur (`400` si l'id est invalide, `404` s'il n'existe pas)   |
| `GET`   | `/api/v1/stats`       | Pays au meilleur ratio de victoires, IMC moyen, taille médiane    |
| `POST`  | `/api/v1/players`     | Ajoute un joueur (clé d'API requise) : `201` + en-tête `Location` |
| `GET`   | `/api/v1/health`      | Healthcheck                                                       |

## Démarrer

**Prérequis** : Node.js 24 (`.nvmrc`) et npm 11.

```bash
npm ci
cp .env.example .env      # optionnel : renseigner API_KEY (16 caractères minimum) pour tester le POST
npm run start:dev         # http://localhost:3000/api/v1 · Swagger : http://localhost:3000/docs
```

Par défaut, l'API sert le jeu de données fourni, chargé en mémoire : **aucun compte AWS ni base de données n'est nécessaire**. Les variables (`PORT`, `API_KEY`, `PLAYERS_TABLE_NAME`…) sont décrites dans `.env.example`.

Pour lancer l'API sur DynamoDB Local ou dans Docker, voir [docs/development.md](docs/development.md).

## Tester

```bash
npm test               # tests unitaires
npm run test:cov       # + couverture (seuils à 90 %)
npm run test:e2e       # tests end-to-end de l'API complète
npm run test:infra     # tests de la stack CDK
npm run lint

# Tests d'intégration : nécessitent DynamoDB Local (Docker)
docker compose up -d dynamodb && DYNAMODB_ENDPOINT=http://localhost:8000 npm run test:int

# Scénarios HTTP boîte noire contre une API lancée, locale ou déployée
BASE_URL=http://localhost:3000 API_KEY=<clé> npm run test:smoke
```

À la main : Swagger UI sur `/docs` (bouton **Authorize** pour saisir la clé avant un `POST`), ou en ligne de commande :

```bash
BASE=http://localhost:3000/api/v1
curl -s "$BASE/players?sex=M"
curl -s "$BASE/players/52"
curl -s "$BASE/stats"
curl -s -i -X POST "$BASE/players" -H "Content-Type: application/json" -H "x-api-key: $API_KEY" \
  -d '{"firstName":"Carlos","lastName":"Alcaraz","shortName":"C.ALC","sex":"M",
       "country":{"code":"ESP","pictureUrl":"https://tenisu.latelier.co/resources/Espagne.png"},
       "pictureUrl":"https://tenisu.latelier.co/resources/Alcaraz.png",
       "stats":{"rank":3,"points":2000,"weightKg":74,"heightCm":183,"age":21,"lastResults":[1,1,0,1,1]}}'
```

Tous les exemples, cas d'erreur compris, et les règles de validation sont dans [docs/api.md](docs/api.md).

## Déployer sur AWS

Prérequis : un compte AWS et des identifiants configurés pour la CLI (`aws sts get-caller-identity` doit répondre).

```bash
echo "API_KEY=$(openssl rand -hex 32)" >> .env       # clé d'API des écritures
npx cdk bootstrap aws://<ACCOUNT_ID>/eu-north-1      # une seule fois par compte et par région
npm run cdk:deploy                                   # affiche ApiUrl et DocsUrl
BASE_URL=<ApiUrl> API_KEY=<clé> npm run test:smoke   # vérifie le déploiement
```

La table DynamoDB est créée et alimentée automatiquement : les migrations s'exécutent pendant le déploiement. Suppression : `npx cdk destroy`.

Ressources créées, déploiement continu via GitHub Actions (OIDC) et rôle IAM à créer : [docs/deployment.md](docs/deployment.md).

## Le projet en bref

**Architecture** : hexagonale légère.

- Le domaine et les services métier sont en TypeScript pur.
- NestJS n'intervient que dans la couche HTTP.
- Deux implémentations du stockage se cachent derrière la même interface : DynamoDB en production, le JSON en mémoire en local.

```
src/
├── players/   domain · application (services, calculs purs) · infrastructure (DynamoDB, mémoire) · presentation (controllers, DTOs)
├── database/  schéma single-table, migrations
├── common/    filtre d'erreurs, guard de clé d'API, pipes
└── main.ts · lambda.ts
infra/         stack AWS CDK
test/          tests e2e et d'intégration
```

**Hypothèses sur les données**

- `weight` est en **grammes** et `height` en **cm**. L'API expose `weightKg` et `heightCm`.
- `last` contient les 5 derniers matchs : `1` = victoire, `0` = défaite.
- Nadal est `rank: 1` avec moins de points que Djokovic (`rank: 2`). **Le tri suit le classement officiel (`rank`)**, et les points restent exposés.

**Choix techniques**

- **NestJS** : structure et validation standard.
- **Lambda + HTTP API** : rien à gérer et coût nul au repos.
- **DynamoDB single-table** : moins cher qu'un RDS et sans connexion à gérer.
- **CDK** : infrastructure en TypeScript, testée.

Le détail est dans [docs/architecture.md](docs/architecture.md).

## Documentation

| Document                                     | Contenu                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| [docs/api.md](docs/api.md)                   | Contrat HTTP, validation, format d'erreur, règles de calcul, exemples      |
| [docs/architecture.md](docs/architecture.md) | Couches, choix techniques justifiés, modèle DynamoDB, migrations, bundling |
| [docs/development.md](docs/development.md)   | Scripts, DynamoDB Local, Docker, stratégie de tests                        |
| [docs/deployment.md](docs/deployment.md)     | Déploiement AWS, clé d'API, CI/CD GitHub Actions, rôle IAM                 |
| [docs/roadmap.md](docs/roadmap.md)           | Pistes d'amélioration et limites connues                                   |
