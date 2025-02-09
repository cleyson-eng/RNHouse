import { DB } from "./lib/db.ts";

await (new DB("./data")).update();