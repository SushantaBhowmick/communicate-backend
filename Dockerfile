
# 1. Use official Node.js LTS image
FROM node:22-alpine

# 2. Set Working directory
WORKDIR /app

# 3. Copy pakcage files first (better cache)
COPY pakcage*.json ./

# 4. Install dependencies 
RUN npm install --production

# 5. copy rest of the code
COPY . .

# 6. Build (if using Typescript /bundler)
RUN npm run Build

# 7. Expose app port
ENV PORT=4000
EXPOSE 4000

# 8. Start with Node (or PM@ if you prefer)
CMD [ "node", "dist/src/index.js" ]