# Pistes d'amélioration et limites connues

[← README](../README.md)

## Pistes d'amélioration

**Données**

- **Statistiques précalculées** : `/stats` lit aujourd'hui tous les joueurs. À grande échelle, on maintiendrait un item agrégé (`PK = STATS`) mis à jour par DynamoDB Streams à chaque écriture.
- Pour un environnement de production : `RemovalPolicy.RETAIN`, deletion protection et point-in-time recovery sur la table.
- Modification et suppression de joueurs, et contrôle d'unicité (`409 Conflict`) si le métier le requiert.
- **Idempotence** du `POST` (header `Idempotency-Key`) : un client qui rejoue sa requête après un timeout ne doit pas créer de doublon.

**API**

- **Pagination** de `GET /players` (`limit` / `cursor`) avec un en-tête `Link`, et le tri paramétrable (`?sort=points`).
- **405 Method Not Allowed** avec en-tête `Allow`, au lieu de 404, pour une méthode non supportée sur une route existante.
- `ETag` et `Cache-Control` sur des données qui changent rarement.
- Une politique CORS explicite si un front consomme l'API.

**Sécurité**

- **Gestion de la clé d'API** : Secrets Manager ou SSM Parameter Store plutôt qu'une variable d'environnement, avec rotation, et une clé par client pour pouvoir en révoquer une seule.
- **Authentification des utilisateurs** : un authorizer JWT natif de l'HTTP API (Cognito, Auth0…) si des humains doivent écrire, avec des rôles.
- **AWS WAF**, qui impose de passer par CloudFront ou par une REST API : rate limiting par IP et règles managées.
- Des actions GitHub épinglées par SHA et Dependabot / Renovate.

**Performance**

- Un **cache** CloudFront devant l'API.
- Un cache applicatif des statistiques.
- De la concurrence provisionnée si le cold start devient critique.

**Observabilité**

- **Powertools for AWS Lambda** : logs corrélés, métriques EMF, traces X-Ray.
- Des alarmes CloudWatch (erreurs 5xx, latence p99, throttles) reliées à SNS.
- Un tableau de bord.

**Exploitation**

- **Déploiement continu** : un job `cdk deploy` sur `main`, authentifié par **OIDC** (rôle IAM endossé avec un jeton GitHub de courte durée, sans clé AWS stockée), suivi des smoke tests en lecture seule sur l'API déployée. Non mis en place : la SCP du compte de démonstration interdit la création du fournisseur OIDC (`iam:CreateOpenIDConnectProvider`).
- Des environnements `staging` / `production` distincts (paramètre de stage dans la stack).
- Un domaine personnalisé (Route 53 + ACM).
- Un déploiement progressif (alias Lambda + CodeDeploy canary).

### Limites connues

- Hors de `/api/v1` et `/docs`, une route inconnue renvoie la 404 par défaut d'Express : le handler 404 de Nest est limité au préfixe global.
- Sur AWS, `GET /players/%20` renvoie la liste et non un `400`. API Gateway transmet le chemin décodé, l'espace final disparaît à la normalisation de l'URL, et la requête devient `GET /players/`.
- `npm audit` signale `brace-expansion` embarqué (`bundledDependencies`) dans `aws-cdk-lib`. Ce module sert uniquement au `synth`, en outil de développement, et n'est pas corrigeable de notre côté. L'arbre de production (`npm audit --omit=dev`) ne contient aucune vulnérabilité.
- La clé d'API est stockée en clair dans la configuration de la Lambda (voir [Clé d'API](deployment.md#clé-dapi)).
- Les tests d'intégration nécessitent Docker en local (DynamoDB Local). Sans Docker, ils sont sautés, mais la CI les exécute.
- L'image Docker embarque `typescript`, peer dependency de `@nestjs/swagger` (pour son plugin CLI). Le bundle Lambda n'est pas concerné.
