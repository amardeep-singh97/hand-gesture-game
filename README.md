# Hand-gesture-game

A quick monorepo. I have used React for Frontend, Express for Backend and PostgreSQL as database.

## Instruction for running this Project in your Local:

### If you have Docker installed in your machine (Recommended)

- You just have to run command `docker compose up`. This will create a postgres instance, build the app and run on port `localhost:3001`
- Before You start using the app. You will need run db migrations. So go to root dir of this project and run `npm run db:push -w server`.
- App should start and now you can vavigate to `localhost:3001` to enjoy.

### Without Docker 

- You have to download and run postgreSQL, You can find the credentials for database in docker-compose.yml file.
- Run `npm run db:push -w server` in Root Dir of this project.
- Run `npm run dev` in Root Dir of this project.
- Sever will start at port 3001 and Vite app will start at 5173. Navigate to `localhost:5173` to enjoy.
