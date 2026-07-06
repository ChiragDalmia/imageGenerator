import { setServers } from "node:dns";
import mongoose, { Mongoose } from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL;
const MONGODB_DNS_SERVERS = process.env.MONGODB_DNS_SERVERS
  ?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (MONGODB_DNS_SERVERS?.length) {
  setServers(MONGODB_DNS_SERVERS);
}

interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> |null;
}

let cached: MongooseConnection = (global as any).mongoose

if (!cached){
  cached = (global as any).mongoose = {
    conn: null, promise:null
  }
}
export const connectToDatabase = async()=>{
  if (cached.conn) return cached.conn;

  if (!MONGODB_URL) throw new Error("MONGODB_URL is not defined");

  cached.promise = 
  cached.promise || 
  mongoose.connect(MONGODB_URL,{
    dbName: "photosynthai", 
    bufferCommands: false
  })

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;

}
