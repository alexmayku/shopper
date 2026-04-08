FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# The mock-tesco server runs on 4002, the build sidecar on 4001. The Kamal
# config publishes both on the host loopback so Rails can reach them via the
# kart-sidecar Docker service name.
EXPOSE 4001 4002

# Start both processes in the same container with a tiny shell wrapper.
CMD ["sh", "-c", "node mock-tesco/server.js & node src/server.js"]
