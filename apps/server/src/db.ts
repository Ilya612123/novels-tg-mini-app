import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./config.js";

ensureDatabaseUrl();

export const prisma = new PrismaClient();
export type DbClient = PrismaClient;
