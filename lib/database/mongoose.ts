import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import mongoose, { Mongoose } from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL;

// Some machines list an unreachable resolver (e.g. 127.0.0.1 from a VPN or
// local DNS stub) as the system DNS server, which makes the driver's SRV
// lookup for mongodb+srv:// URLs fail with "querySrv ECONNREFUSED". Override
// with MONGODB_DNS_SERVERS, falling back to public resolvers on retry.
const CONFIGURED_DNS_SERVERS = process.env.MONGODB_DNS_SERVERS
  ?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);

const FALLBACK_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];

// The MongoDB driver resolves SRV records through dns.promises, whose default
// resolver is distinct from the callback API's in some Node versions — set
// both. setServers throws if any DNS query is in flight, so tolerate failure
// here and let the retry below apply it again.
const applyDnsServers = (servers: string[]) => {
  try {
    dns.setServers(servers);
    dnsPromises.setServers(servers);
    return true;
  } catch (error) {
    console.warn(
      `Could not apply DNS servers ${servers.join(", ")}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
};

const isSrvLookupError = (error: unknown): boolean =>
  error instanceof Error &&
  /querySrv|queryTxt|ENOTFOUND|ECONNREFUSED|ESERVFAIL|ETIMEOUT/i.test(
    error.message
  );

interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

let cached: MongooseConnection = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = {
    conn: null,
    promise: null,
  };
}

const connect = (url: string) =>
  mongoose.connect(url, {
    dbName: "photosynthai",
    bufferCommands: false,
    // Fail fast instead of buffering for the default 30s when the cluster is
    // unreachable, so pages degrade quickly rather than hang.
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

const connectWithDnsFallback = async (url: string): Promise<Mongoose> => {
  if (CONFIGURED_DNS_SERVERS?.length) {
    applyDnsServers(CONFIGURED_DNS_SERVERS);
  }

  try {
    return await connect(url);
  } catch (error) {
    // Only SRV/DNS failures are retryable with different resolvers; anything
    // else (bad credentials, IP not allowlisted) should surface as-is.
    if (!isSrvLookupError(error)) throw error;

    const retryServers = CONFIGURED_DNS_SERVERS?.length
      ? CONFIGURED_DNS_SERVERS
      : FALLBACK_DNS_SERVERS;

    console.warn(
      `MongoDB SRV lookup failed (system DNS: ${dns
        .getServers()
        .join(", ")}); retrying with ${retryServers.join(", ")}`
    );

    if (!applyDnsServers(retryServers)) throw error;

    return await connect(url);
  }
};

export const connectToDatabase = async () => {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URL) throw new Error("MONGODB_URL is not defined");

  cached.promise = cached.promise || connectWithDnsFallback(MONGODB_URL);

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
};
