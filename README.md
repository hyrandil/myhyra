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

## Step-by-step tutorial (Docker beginners welcome)

The following walkthrough assumes you are on Windows, macOS, or Linux with Docker Desktop (or Docker Engine) installed. Every step is spelled out so you can follow along even if you have never used Docker before.

1. **Install prerequisites.**
   - Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it is running.
   - Install the [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) if you plan to build or run the API outside of containers.
   - (Optional) Install [Node.js 20+](https://nodejs.org/) if you want to run the Next.js app locally.
2. **Clone the repository.** In a terminal or PowerShell window, run:
   ```bash
   git clone <your-repo-url>
   cd myhyra
   ```
3. **Create the environment file.** Copy the template and edit it with your favourite editor:
   ```bash
   cp .env.example .env
   ```
   Fill in the following values:
   - `JWT_SECRET`: random string (e.g. generated via `openssl rand -base64 32`).
   - `STRIPE_*` keys: use Stripe test keys or leave the defaults if you only want to explore the UI.
   - `PUBLIC_URL`: leave as `http://localhost` for local testing.
4. **Start the stack.** Build and launch all services in the background:
   ```bash
   docker compose up -d --build
   ```
   The first run downloads Docker images and may take a few minutes. Subsequent runs are faster because Docker caches the layers.
5. **Check container status.** Confirm everything is healthy:
   ```bash
   docker compose ps
   docker compose logs api -f
   ```
   Wait until the `api` service reports `Now listening on: http://0.0.0.0:8080` and migrations have completed.
6. **Open the applications.**
   - API (Swagger UI): <http://localhost:8080/swagger>
   - Webshop / Admin UI: <http://localhost:3000>
   - The first time you open an admin page, sign in with the seeded credentials
     (`admin@example.com` / the password configured in `ADMINSEED__PASSWORD`).
     You can prefill the login form by setting `NEXT_PUBLIC_ADMIN_DEFAULT_EMAIL`
     (and optionally `NEXT_PUBLIC_ADMIN_DEFAULT_PASSWORD`) in your `.env` file.
7. **Shut everything down.** When you are done testing, stop the containers with:
   ```bash
   docker compose down
   ```

If you encounter issues, rerun with `docker compose up --build` (without `-d`) to see live logs.

## Service endpoints

- API: <http://localhost:8080> (Swagger at `/swagger`)
- Frontend: <http://localhost:3000>
- Reverse proxy (Caddy): <http://localhost>

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
