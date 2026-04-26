# BatchCraft 🧪

**Multi-tenant recipe management, batch tracking, and raw material inventory for soap, lotion, lip balm, and candle makers.**

Built to run on your forge server with Docker + Nginx Proxy Manager.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Flask + SQLAlchemy + Flask-JWT-Extended |
| Database | PostgreSQL 16 |
| Frontend | React + Vite + Tailwind CSS |
| Auth | JWT (access + refresh tokens) |
| Deployment | Docker Compose + Nginx Proxy Manager |

---

## Repository layout

Docker expects this **repository root** as the Compose project directory (`docker compose` reads `docker-compose.yml` and `.env` here):

```text
.
├── docker-compose.yml
├── .env.example
├── backend/          # Flask API (Dockerfile)
└── frontend/         # Vite build + Nginx (Dockerfile)
```

---

## Quick Start (Local Dev)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with real secrets

# 2. Start services
docker compose up -d

# 3. Run migrations
docker compose exec backend flask db init
docker compose exec backend flask db migrate -m "initial"
docker compose exec backend flask db upgrade

# 4. Frontend dev server
cd frontend && npm install && npm run dev
```

App runs at: http://localhost:6000  
API (direct, optional): http://localhost:6001

---

## Forge Deployment (Nginx Proxy Manager)

Point your Forge site’s Git **root** at this repository so `$FORGE_SITE_PATH` contains `docker-compose.yml`, `backend/`, and `frontend/`.

```bash
# 1. Sync to server (example path — use your Forge site directory)
rsync -av --exclude node_modules --exclude .git . forge@your-server:/home/forge/yourdomain.com/

# 2. On the server: cp .env.example .env and edit for production

# 3. From that same directory (the repo root):
docker compose up -d --build

# 4. In Nginx Proxy Manager:
#    Proxy host → your public hostname → http://127.0.0.1:6000
#    (Compose maps the frontend container to host port 6000; it proxies /api to the backend.)
#    SSL: Let's Encrypt as usual
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Create tenant + owner account |
| POST | /api/auth/login | Login, returns JWT pair |
| POST | /api/auth/refresh | Refresh access token |
| GET | /api/auth/me | Current user + tenant |

### Recipes
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/recipes/ | List all recipes |
| POST | /api/recipes/ | Create recipe with ingredients |
| GET | /api/recipes/:id | Get recipe detail |
| PUT | /api/recipes/:id | Update recipe (bumps version) |
| POST | /api/recipes/:id/scale | Calculate scaled amounts |

### Batches
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/batches/ | List batches |
| POST | /api/batches/ | Create batch (snapshots recipe) |
| POST | /api/batches/:id/complete | Complete batch + deduct inventory |
| GET | /api/batches/:id/traceability | Full lot traceability report |

### Ingredients
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/ingredients/?stock=true | List with stock levels |
| POST | /api/ingredients/ | Add ingredient |
| POST | /api/ingredients/:id/lots | Receive a new lot (auto-credits inventory) |
| GET | /api/ingredients/:id/transactions | Full inventory ledger |

### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/inventory/ | All ingredients with stock |
| POST | /api/inventory/adjust | Manual adjustment entry |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/reports/dashboard | Stats + recent batches + low stock |

---

## Data Architecture Notes

**Multi-tenancy:** Shared DB with `tenant_id` on every table. JWT carries tenant context — enforced at service layer.

**Inventory:** Ledger pattern (append-only `inventory_transactions`). Stock on hand = sum of all deltas. Full audit trail, no data loss.

**Recipe versioning:** Immutable snapshots stored in `recipe_versions` when a batch is created. A batch always knows the exact formula used, even if the recipe changes later.

**Batch traceability:** `batch_ingredients` links each ingredient to a specific `lot_id`, so you can answer: "which batches used lot X?" or "what lots went into batch BC-20241215-0001?"

---

## Build Order (Recommended)

1. ✅ Data model + migrations
2. ✅ Auth (register, login, JWT, tenant bootstrap)  
3. ✅ Ingredient CRUD + lot receiving + inventory ledger
4. ✅ Recipe builder + versioning + scale calculator
5. ✅ Batch logging + completion + inventory deduction
6. ✅ Reports API + dashboard stats
7. 🔲 Frontend: Recipe builder UI
8. 🔲 Frontend: Batch workflow
9. 🔲 Frontend: Inventory management
10. 🔲 CSV/PDF exports
11. 🔲 Shopify product sync (finished goods)
12. 🔲 Stripe billing + plan gating
