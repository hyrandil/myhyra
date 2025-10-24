# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS restore
WORKDIR /src

# Copy project files individually to leverage Docker layer caching
COPY HvShop.sln ./
COPY src/HvShop.Domain/HvShop.Domain.csproj src/HvShop.Domain/
COPY src/HvShop.Infrastructure/HvShop.Infrastructure.csproj src/HvShop.Infrastructure/
COPY src/HvShop.Api/HvShop.Api.csproj src/HvShop.Api/

RUN dotnet restore src/HvShop.Api/HvShop.Api.csproj

FROM restore AS build
COPY . .
WORKDIR /src/src/HvShop.Api
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "HvShop.Api.dll"]
