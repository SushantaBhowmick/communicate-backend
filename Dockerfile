
# 1. Use official Node.js LTS image
FROM node:22-alpine

# 2. Set Working directory
WORKDIR /app

# 3. Copy pakcage files first (better cache)
COPY package*.json ./

# 4. Install dependencies 
RUN npm install 

# 5. copy rest of the code
COPY . .

# 6. Build (if using Typescript /bundler)
RUN npm run build

# 7. Remove devDependencies to slim down (optional)
RUN npm prune --production

# 8. Expose app port
ENV PORT=4000
EXPOSE 4000

# 9. Start with Node (or PM2 if you prefer)
CMD ["npm", "run", "start"]