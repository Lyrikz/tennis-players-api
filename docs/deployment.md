# Déploiement et CI/CD

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

En CI, elle provient du secret GitHub `API_KEY`. Pour la changer, il suffit de redéployer avec une nouvelle valeur.

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

## CI/CD GitHub Actions

| Workflow                       | Déclencheur                 | Jobs                                                                                                              |
| ------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`     | Chaque PR (et réutilisable) | format, lint, typecheck · tests unitaires, e2e et infra · intégration contre DynamoDB Local · build + `cdk synth` |
| `.github/workflows/deploy.yml` | Push sur `main`, manuel     | CI complète, puis `cdk deploy` et les smoke tests en lecture seule sur l'API déployée                             |

Le déploiement s'authentifie auprès d'AWS via **OIDC** : GitHub émet un jeton court, échangé contre des identifiants temporaires. **Aucune clé AWS n'est stockée dans GitHub.**

### Rôle IAM à créer (une seule fois)

**1. Déclarer GitHub comme fournisseur OIDC du compte**

S'il n'existe pas déjà :

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

**2. Créer le rôle `github-actions-tennis-players-deploy`**

Sa politique de confiance (`trust-policy.json`) restreint l'usage du rôle **à ce dépôt et à l'environnement `production`** :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:<GITHUB_OWNER>/<GITHUB_REPO>:environment:production"
        }
      }
    }
  ]
}
```

**3. Donner au rôle le minimum de permissions**

Avec CDK, le pipeline n'a besoin **que** de pouvoir endosser les rôles créés par `cdk bootstrap`. Ce sont eux qui portent les droits CloudFormation, S3 et ECR. Politique à attacher (`deploy-policy.json`) :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<ACCOUNT_ID>:role/cdk-hnb659fds-*-<ACCOUNT_ID>-eu-north-1"
    }
  ]
}
```

Création du rôle et rattachement de la politique :

```bash
aws iam create-role --role-name github-actions-tennis-players-deploy \
  --assume-role-policy-document file://trust-policy.json
aws iam put-role-policy --role-name github-actions-tennis-players-deploy \
  --policy-name cdk-deploy --policy-document file://deploy-policy.json
```

**4. Configurer le dépôt GitHub**

Dans _Settings → Environments_, créer l'environnement `production` (on peut y ajouter des reviewers obligatoires), puis définir ces variables (des _variables_, pas des secrets) :

| Variable              | Valeur                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-tennis-players-deploy` |
| `AWS_REGION`          | `eu-north-1`                                                          |

Il faut aussi définir le **secret** `API_KEY` de l'environnement `production` : c'est la clé d'API passée à la Lambda.
