# Contrat de l'API et règles métier

[← README](../README.md) · La documentation interactive (Swagger UI) est servie sur `/docs`.

## Hypothèses sur les données

Le jeu de données fourni par le client est `src/players/infrastructure/data/players.json`. Il est importé dans DynamoDB par la migration `001-seed-players`, et sert directement le repository en mémoire en local.

| Donnée brute            | Interprétation                                    | Exposition dans l'API                                                                    |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `data.weight`           | **Grammes** (`80000` = 80 kg)                     | `stats.weightKg`                                                                         |
| `data.height`           | **Centimètres**                                   | `stats.heightCm`                                                                         |
| `data.last`             | 5 derniers matchs : `1` = victoire, `0` = défaite | `stats.lastResults`. L'ordre chronologique n'étant pas précisé, aucun calcul n'en dépend |
| `data.rank`             | Classement officiel (1 = meilleur)                | `stats.rank`                                                                             |
| `firstname`, `picture`… | Nommage de la source                              | Renommés en camelCase explicite : `firstName`, `pictureUrl`…                             |

### Incohérence rank / points

Nadal est `rank: 1` avec **1 982** points, alors que Djokovic est `rank: 2` avec **2 542** points. **Le tri se fait sur `rank`** : c'est le classement officiel qui fait foi, et les points peuvent refléter une fenêtre de calcul différente (points « à défendre », classement en cours de mise à jour). Ce choix est isolé dans `PlayersService`, et les deux valeurs restent exposées pour que le client puisse trier autrement.

### Règles de calcul de `/stats`

- **Meilleur pays** : les matchs de tous les joueurs d'un même pays sont **cumulés** (Σ victoires / Σ matchs), ce qui donne le même poids à chaque match. En cas d'égalité, le pays qui a le plus de matchs l'emporte (échantillon plus significatif), puis l'ordre alphabétique du code (résultat déterministe). Un pays sans aucun match est ignoré. Le ratio est arrondi à 2 décimales, et `wins` et `matches` sont exposés pour la transparence.
- **IMC moyen** : moyenne des IMC **individuels**, poids (kg) / taille (m)², arrondie à 2 décimales. Ce n'est pas l'IMC du poids moyen et de la taille moyenne, qui donnerait un résultat légèrement différent.
- **Taille médiane** : valeur centrale si le nombre de joueurs est impair, moyenne des deux valeurs centrales s'il est pair. Elle est exprimée en cm.
- **Aucun joueur** : les trois valeurs valent `null`, avec un statut `200`. Une statistique vide n'est pas une erreur, et `null` est plus explicite que `NaN` ou `0`.

Sur le jeu de données fourni, le résultat est : SRB avec un ratio de 1 (5/5), un IMC moyen de **23,36** et une taille médiane de **185 cm**.

## Contrat HTTP

### Codes HTTP

| Code  | Cas                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `200` | Succès, y compris une liste filtrée vide (`[]`) : une collection vide n'est pas une ressource absente                           |
| `201` | Joueur créé (`POST`), avec l'en-tête `Location` vers la nouvelle ressource                                                      |
| `400` | Id qui n'est pas un entier strictement positif, filtre invalide, paramètre de query inconnu ou répété, corps de `POST` invalide |
| `401` | `POST` sans clé d'API ou avec une clé invalide                                                                                  |
| `404` | Joueur introuvable, route inconnue sous `/api/v1`                                                                               |
| `500` | Erreur inattendue : message générique, détails uniquement dans les logs                                                         |

`ParsePositiveIntPipe` remplace `ParseIntPipe`, qui laisse passer `-1`, `0` ou `+1`. Il n'accepte que des entiers strictement positifs sous forme décimale canonique : `01`, `1.5`, `1e3` et les valeurs au-delà de `MAX_SAFE_INTEGER` sont refusés.

Les filtres `sex` et `country` sont insensibles à la casse et normalisés en majuscules. `country` doit être un code ISO 3166-1 alpha-3.

### Ajout d'un joueur

`POST /api/v1/players` prend **le même format que la réponse de `GET /players/:id`, sans l'`id`**, qui est attribué par le serveur. Le poids est donc en kilogrammes : le contrat est symétrique en lecture et en écriture.

| Champ                                             | Règle                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| `firstName`, `lastName`                           | Non vides (espaces retirés), 50 caractères maximum     |
| `shortName`                                       | 2 à 10 caractères                                      |
| `sex`                                             | `M` ou `F`, insensible à la casse                      |
| `country.code`                                    | ISO 3166-1 alpha-3, insensible à la casse              |
| `pictureUrl`, `country.pictureUrl`                | URL `https`                                            |
| `stats.rank`                                      | Entier de 1 à 99 999                                   |
| `stats.points`                                    | Entier ≥ 0                                             |
| `stats.weightKg` / `stats.heightCm` / `stats.age` | 30–200 kg / entier de 100 à 250 cm / entier de 10 à 80 |
| `stats.lastResults`                               | 0 à 5 valeurs, chacune `1` (victoire) ou `0` (défaite) |

Tout champ inconnu, y compris un `id` imposé par le client, est refusé (`400`). Les types sont stricts : `"3"` n'est pas accepté comme entier.

L'unicité (par exemple deux joueurs du même sexe avec le même rang) n'est volontairement pas contrôlée : elle impliquerait de gérer le décalage des classements, hors du périmètre.

**Authentification** : la clé est passée dans le header `x-api-key`. Elle est comparée en temps constant, via son empreinte SHA-256, pour ne rien laisser fuiter par le temps de réponse. La lecture reste publique.

### Format d'erreur uniforme

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": ["sex must be one of the following values: M, F"],
  "path": "/api/v1/players?sex=X",
  "timestamp": "2026-09-30T10:05:16.922Z"
}
```

`details` n'apparaît que pour les erreurs de validation.

### Exemples

```bash
BASE=http://localhost:3000/api/v1   # ou l'URL déployée

# Liste triée par classement officiel
curl -s "$BASE/players"

# Filtres (insensibles à la casse)
curl -s "$BASE/players?sex=F"
curl -s "$BASE/players?sex=M&country=srb"

# Un joueur
curl -s "$BASE/players/52"
# → {"id":52,"firstName":"Novak","lastName":"Djokovic","shortName":"N.DJO","sex":"M",
#    "country":{"code":"SRB","pictureUrl":"…"},"pictureUrl":"…",
#    "stats":{"rank":2,"points":2542,"weightKg":80,"heightCm":188,"age":31,"lastResults":[1,1,1,1,1]}}

# Erreurs
curl -s "$BASE/players/abc"          # 400 id must be a positive integer
curl -s "$BASE/players/999"          # 404 Player with id 999 not found
curl -s "$BASE/players?sex=X"        # 400 Validation failed
curl -s "$BASE/players?foo=bar"      # 400 property foo should not exist

# Statistiques
curl -s "$BASE/stats"
# → {"bestCountry":{"code":"SRB","winRatio":1,"wins":5,"matches":5},"averageBmi":23.36,"medianHeightCm":185}

# Ajout d'un joueur (clé d'API requise)
curl -s -i -X POST "$BASE/players" \
  -H "Content-Type: application/json" -H "x-api-key: $API_KEY" \
  -d '{"firstName":"Carlos","lastName":"Alcaraz","shortName":"C.ALC","sex":"M",
       "country":{"code":"ESP","pictureUrl":"https://tenisu.latelier.co/resources/Espagne.png"},
       "pictureUrl":"https://tenisu.latelier.co/resources/Alcaraz.png",
       "stats":{"rank":3,"points":2000,"weightKg":74,"heightCm":183,"age":21,"lastResults":[1,1,0,1,1]}}'
# → HTTP/1.1 201 Created
#   Location: /api/v1/players/103
#   {"id":103,"firstName":"Carlos",…}

curl -s -X POST "$BASE/players" -H "Content-Type: application/json" -d '{}'
# → 401 Missing or invalid API key

# Healthcheck
curl -s "$BASE/health"
# → {"status":"ok","uptime":12.34}

# Document OpenAPI
curl -s "${BASE%/api/v1}/docs/json"
```
