import { DB } from "./lib/db.ts";
import { runServer } from "./lib/server.ts";

runServer(8080, new DB("./data"));