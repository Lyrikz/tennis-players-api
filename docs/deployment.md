# Déploiement et intégration continue

[← README](../README.md)

## Déploiement sur AWS

### Prérequis

- Un compte AWS et des identifiants configurés localement (`aws configure sso` ou un profil).
- Node.js 24. La CLI CDK est une dépendance du projet (`npx cdk`), aucune installation globale n'est nécessaire.
- La région par défaut est `eu-north-1` (Stockholm). Elle se change via `AWS_REGION`, dans le shell ou dans `.env`, et doit être la même pour le bootstrap et le déploiement.

### Première fois : bootstrap CDK

Le bootstrap crée, une fois par compte et par région, le bucket d'assets et les rôles utilisés par CDK.

```bash
npx cdk bootstrap aws://<ACCOUNT_ID>/eu-north-1
```

### Clé d'API

Les écritures exigent une clé d'API, passée à la Lambda **en variable d'environnement**. Elle doit être fournie à `synth`, `diff` et `deploy` (16 caractères minimum, sinon la commande échoue avec un message explicite), mais pas à `cdk bootstrap`. Elle peut être exportée dans le shell ou écrite dans `.env` :

```bash
export API_KEY=$(openssl rand -hex 32)          # à conserver : c'est la valeur à envoyer dans x-api-key
# ou : echo "API_KEY=$(openssl rand -hex 32)" >> .env
```

Pour la changer, il suffit de redéployer avec une nouvelle valeur.

Limite assumée : une variable d'environnement est lisible par quiconque a accès en lecture à la configuration de la Lambda ou au template CloudFormation. En production, on la stockerait dans Secrets Manager ou SSM Parameter Store (voir [roadmap.md](roadmap.md)).

### Déployer

```bash
npm run cdk:diff      # optionnel : ce qui va changer
npm run cdk:deploy
```

Les URLs sont affichées en sortie :

```
Outputs:
TennisPlayersApi.ApiUrl  = https://<api-id>.execute-api.eu-north-1.amazonaws.com/api/v1
TennisPlayersApi.DocsUrl = https://<api-id>.execute-api.eu-north-1.amazonaws.com/docs
TennisPlayersApi.TableName = TennisPlayersApi-Table…
```

Les migrations sont appliquées pendant le déploiement : aucune étape manuelle n'est nécessaire. Leur log est dans le log group de la fonction `MigrationFunction`.

Pour vérifier le déploiement :

```bash
BASE_URL=<ApiUrl> API_KEY=$API_KEY npm run test:smoke
```

### Ressources créées

- Une **table DynamoDB** on-demand avec deux GSI, supprimée avec la stack (environnement de démonstration : les données se reconstruisent depuis les migrations).
- Une fonction **Lambda d'API** : Node.js 24, arm64, 1 024 Mo, timeout de 10 s, logs JSON. Elle lit la table et ne peut écrire que des joueurs et le compteur d'ids.
- Une fonction **Lambda de migration** (arm64, timeout de 5 min) et la custom resource qui la déclenche à chaque déploiement.
- Une **HTTP API** avec la route `$default` en proxy vers la Lambda, et un stage `$default` auto-déployé :
  - **throttling** à 50 req/s en régime normal et 100 en burst, pour plafonner la facture d'une API dont la lecture est publique ;
  - **access logs** au format JSON.
- Quatre **log groups** (API, migration, provider de la custom resource, access logs) avec une rétention de 30 jours, supprimés avec la stack.

Le coût d'une démo est négligeable : sans trafic, rien n'est facturé hormis quelques Ko de stockage DynamoDB et de logs.

Pour tout supprimer : `npx cdk destroy`.

## Intégration continue

`.github/workflows/ci.yml` tourne à chaque push sur `main` et sur chaque pull request :

| Job               | Étapes                                                               |
| ----------------- | -------------------------------------------------------------------- |
| Lint & typecheck  | `format:check`, `lint`, `typecheck`                                  |
| Tests             | Tests unitaires avec seuils de couverture, e2e et infra (CDK)        |
| Integration tests | Tests d'intégration contre DynamoDB Local (service container)        |
| Build & CDK synth | Build de l'application, bundling des Lambdas et synthèse du template |

Le déploiement se fait depuis un poste avec `npm run cdk:deploy`, comme décrit ci-dessus. Le déploiement continu (OIDC, sans clé AWS stockée) n'est pas mis en place : le compte AWS de démonstration interdit la création d'un fournisseur OIDC. Voir [roadmap.md](roadmap.md).
