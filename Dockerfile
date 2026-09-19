# Multi-stage Dockerfile for testing and deployment
FROM node:22-alpine AS tester
WORKDIR /app
COPY package.json .
COPY src/ ./src/
COPY test/ ./test/
COPY index.html .
# Run unit & integration tests
RUN npm test

FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html
COPY index.html .
COPY src/ ./src/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
