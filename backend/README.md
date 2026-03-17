# InvadersHunter Backend

## Neon cloud database setup

This project uses SQLAlchemy and expects `DATABASE_URL` to be set in env.

### 1) Create Neon project + database

1. Sign in to neon.tech.
2. Create project and branch (`main`/`dev`).
3. Go to **Connection strings** and copy your Postgres URL.

Example: `postgresql://<user>:<password>@<host>:5432/neondb?sslmode=require`

### 2) Add Neon URL to secret manager (recommended)

You should avoid storing the connection string in plaintext in the repo. Use your cloud provider or CI secret store:

- GitHub Actions: `Settings > Secrets and variables > Actions > New repository secret`
  - Key: `DATABASE_URL`
  - Value: your Neon URL

- GitLab CI: `Settings > CI/CD > Variables`.
- Azure Key Vault / AWS Secrets Manager / GCP Secret Manager: store secret there and inject at runtime.

### 3) Local development with `.env` file

Create `.env` at `backend/` (ignored by default best practice):

```ini
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>?sslmode=require
```

Then run:

```bash
pip install -r requirements.txt
python -m app.create_tables
uvicorn app.main:app --reload
```

### 4) Read-only in code (auto loaded)

`app/database.py` now checks for missing value and raises early:

- `load_dotenv()` reads `.env`
- `DATABASE_URL = os.getenv("DATABASE_URL")`
- raise `RuntimeError` if missing

### 5) CI example

Use this sample workflow for GitHub Actions in `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install deps
        run: pip install -r requirements.txt
      - name: Set DB URL
        run: echo "DATABASE_URL=$DATABASE_URL" > .env
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Create tables
        run: python -m app.create_tables
      - name: Run tests
        run: pytest
```

## Troubleshooting

- If `DATABASE_URL is not set` error appears, confirm secret exists and environment loads before process start.
- If connection fails, verify URL, user creds, and that Neon compute is running.
