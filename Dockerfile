# Use official node image as the base image
FROM node:14-alpine

# Set the working directory
WORKDIR /app

# Add the source code to app
COPY package.json package-lock.json ./

# Install all the dependencies
RUN npm ci --prod

# Stage 2: Serve app

WORKDIR /app

COPY --from=0 /app .

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
