# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS restore
WORKDIR /src
COPY HvShop.sln ./
COPY src/HvShop.Domain/HvShop.Domain.csproj src/HvShop.Domain/
COPY src/HvShop.Infrastructure/HvShop.Infrastructure.csproj src/HvShop.Infrastructure/
COPY src/HvShop.Worker/HvShop.Worker.csproj src/HvShop.Worker/

RUN dotnet restore src/HvShop.Worker/HvShop.Worker.csproj

FROM restore AS build
COPY . .
WORKDIR /src/src/HvShop.Worker
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./
ENTRYPOINT ["dotnet", "HvShop.Worker.dll"]
