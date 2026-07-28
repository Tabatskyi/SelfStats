FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/submodules/awesome-github-stats/src/AwesomeGithubStats.Api/AwesomeGithubStats.Api.csproj", "AwesomeGithubStats.Api/"]
COPY ["src/submodules/awesome-github-stats/src/AwesomeGithubStats.Core/AwesomeGithubStats.Core.csproj", "AwesomeGithubStats.Core/"]
RUN dotnet restore "AwesomeGithubStats.Api/AwesomeGithubStats.Api.csproj"
COPY src/submodules/awesome-github-stats/src/ .

# Clear dummy PAT so only PATS__0 env var is used
RUN sed -i 's/"your_pat_here"/""/g' AwesomeGithubStats.Api/appsettings.json

WORKDIR "/src/AwesomeGithubStats.Api"
RUN dotnet build "AwesomeGithubStats.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "AwesomeGithubStats.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AwesomeGithubStats.Api.dll"]
