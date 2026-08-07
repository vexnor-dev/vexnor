import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? "vexnor";

const client = new MongoClient(MONGODB_URI);

export const mongoDb = client.db(MONGODB_DATABASE);
