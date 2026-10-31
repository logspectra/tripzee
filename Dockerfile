# Multi-stage build: React app → Spring Boot jar → slim JRE runtime.
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /backend
COPY backend/pom.xml ./
RUN mvn -q dependency:go-offline
COPY backend/src ./src
COPY --from=web /web/dist ./src/main/resources/static
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 1001 tripzee
COPY --from=backend /backend/target/tripzee-backend-0.1.0-SNAPSHOT.jar app.jar
USER tripzee
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
