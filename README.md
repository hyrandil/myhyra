# Hyper-V Cloud Shop

A mono-repository containing a Hyper-V focused infrastructure-as-a-service stack with a Next.js based webshop, ASP.NET Core control plane, and Windows agent.

## Repository structure

```
server/         # ASP.NET Core API, EF Core data layer, Hangfire worker
web/            # Next.js 15 webshop and admin interface
agent/          # Windows service agent and installer scripts
docs/           # API examples and additional documentation
ops/            # Deployment manifests (Caddyfile, docker compose assets)
```

## Quickstart (local with Docker Compose)

```bash
cp .env.example .env
# adjust secrets, Stripe keys, and URLs

docker compose up -d --build
```

Services:

- API: https://localhost:8080 (Swagger at `/swagger`)
- Frontend: http://localhost:3000
- Caddy proxy: https://localhost

## Agent installation (Windows)

1. Build the agent with `dotnet publish -c Release agent/src/HyperV.Agent.Service/HyperV.Agent.Service.csproj`.
2. Copy the published folder to the desired Windows host.
3. Run PowerShell as Administrator:

```powershell
./install-agent.ps1 -ServerUrl "https://your-api.example.com" -EnrollmentToken "<token>"
```

The installer writes configuration to `C:\ProgramData\HyperVAgent\agent.json` and registers the `HyperVAgent` Windows service.

## Development notes

- The API uses Entity Framework Core with PostgreSQL. Update the connection string via `ConnectionStrings:Default`.
- JWT secret and Stripe keys are loaded from environment variables.
- The Hangfire worker performs simple provisioning dispatch and metrics cleanup.
- Next.js frontend consumes the API via `NEXT_PUBLIC_API_URL`.

## Testing & Linting

- Backend: `dotnet format` (requires .NET SDK)
- Frontend: `npm run lint` inside `web/`
- Infrastructure scripts: PowerShell files in `agent/tools`

## License

MIT
