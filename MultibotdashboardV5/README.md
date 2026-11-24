# 🤖 Freqtrade Multi-Bot Dashboard

A modern, real-time dashboard for monitoring and controlling multiple [Freqtrade](https://www.freqtrade.io/) trading bots from a single interface.

![Dashboard Screenshot](docs/screenshot.png)

## ✨ Features

- **Multi-Bot Management** - Monitor and control all your Freqtrade bots from one place
- **Real-Time Updates** - Live WebSocket data streaming for instant status updates
- **Auto-Discovery** - Automatically detects bots via Docker containers or filesystem scanning
- **Portfolio Analytics** - Aggregated performance metrics across all bots
- **Trade History** - Detailed trade logs with filtering and export
- **Bot Health Monitoring** - Track uptime, latency, and error rates
- **Alert System** - Configurable alerts for bot status changes, drawdowns, etc.
- **Dark/Light Mode** - Beautiful UI with theme support
- **Mobile Responsive** - Works great on desktop and mobile devices

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│         React 18 + TypeScript + Vite            │
│         Tailwind CSS + Recharts                 │
└─────────────────────┬───────────────────────────┘
                      │ REST API + WebSocket
┌─────────────────────▼───────────────────────────┐
│                    Backend                       │
│              FastAPI + Python 3.11+             │
│    SQLAlchemy 2.0 + Pydantic + structlog       │
└─────────────────────┬───────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌───────┐       ┌───────────┐     ┌──────────┐
│ Docker │       │ Filesystem │     │ REST API │
│  Scan  │       │   Scan     │     │ (bots)   │
└───────┘       └───────────┘     └──────────┘
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/xF0x0F/freqtrade-dashboard.git
cd freqtrade-dashboard

# Copy and edit configuration
cp config/dashboard.example.yaml config/dashboard.yaml
# Edit config/dashboard.yaml with your settings

# Set environment variables
export JWT_SECRET=$(openssl rand -hex 32)

# Start all services
docker-compose up -d

# Access the dashboard
open http://localhost:5000
```

### Manual Installation

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start the server
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
```

## ⚙️ Configuration

Copy `config/dashboard.example.yaml` to `config/dashboard.yaml` and adjust settings:

```yaml
# Server settings
server:
  host: "0.0.0.0"
  port: 8000
  cors_origins:
    - "http://localhost:5000"

# Database (PostgreSQL recommended for production)
database:
  url: "postgresql://user:pass@localhost:5432/dashboard"

# Bot discovery
discovery:
  docker:
    enabled: true
    image_patterns:
      - "freqtradeorg/freqtrade"
  filesystem:
    enabled: true
    scan_paths:
      - "/opt/freqtrade/*/user_data"

# Default credentials for Freqtrade API
api_defaults:
  username: "your_username"
  password: "your_password"

# Authentication
auth:
  jwt_secret: "${JWT_SECRET}"  # Set via environment variable!
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens (required!) | - |
| `DATABASE_URL` | Database connection string | SQLite |
| `DASHBOARD_SERVER__PORT` | Server port | 8000 |

## 🔌 Bot Discovery

The dashboard can discover your Freqtrade bots automatically:

### Docker Discovery

Scans running Docker containers for Freqtrade images. Works out of the box if your bots run in Docker.

### Filesystem Discovery

Scans specified directories for Freqtrade trade databases (`tradesv3.sqlite`). Useful for native installations.

### Manual Registration

You can also manually register bots via the dashboard UI or API.

## 📊 API Documentation

Once running, access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔐 Authentication

The dashboard uses JWT-based authentication with role-based access control:

| Role | Permissions |
|------|-------------|
| `admin` | Full access, user management |
| `operator` | View + control bots |
| `readonly` | View only |

Default admin credentials (change immediately!):
- Username: `admin`
- Password: `admin`

## 🛠️ Development

### Backend

```bash
cd backend

# Run tests
pytest

# Linting
ruff check .

# Type checking
mypy src
```

### Frontend

```bash
cd frontend

# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Credits

Created by **[xF0x0F](https://github.com/xF0x0F)**

Built with:
- [Freqtrade](https://www.freqtrade.io/) - The trading bot
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) - Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Charts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📫 Support

- **Issues**: [GitHub Issues](https://github.com/xF0x0F/freqtrade-dashboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/xF0x0F/freqtrade-dashboard/discussions)

---

<p align="center">
  Made with ❤️ for the Freqtrade community
</p>
