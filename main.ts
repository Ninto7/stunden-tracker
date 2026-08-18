import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataPath = app.getPath("userData");
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

const isDev = !app.isPackaged;

const dbPath = isDev
  ? path.join(__dirname, "prisma/dev.db")
  : path.join(app.getPath("userData"), "custom.db");

console.log("--> Aktuell genutzter DB-Pfad:", dbPath);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

async function ensureTablesExist() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "lohn" REAL NOT NULL DEFAULT 0.0
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TimeEntry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "time" REAL NOT NULL,
        "date" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Ueberweisung" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "geld" REAL NOT NULL,
        "date" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      );
    `);

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" ADD COLUMN "lohn" REAL NOT NULL DEFAULT 0.0;
      `);
    } catch (_e) {

    }

    console.log("Datenbank erfolgreich synchronisiert.");
  } catch (err) {
    console.error("Fehler beim Initialisieren der Datenbank:", err);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: "Stunden-Tracker",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, "../public/index.html"));
}

app.whenReady().then(async () => {
  await ensureTablesExist();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- IPC HANDLER  ---

ipcMain.handle("get-users", async () => {
  try {
    const users = await prisma.user.findMany({
      include: { timeEntries: true },
    });
    return JSON.parse(JSON.stringify(users));
  } catch (error) {
    console.error("Fehler bei get-users:", error);
    return [];
  }
});

ipcMain.handle("create-user", async (_event, name: string, lohn: number) => {
  try {
    const user = await prisma.user.create({
      data: { 
        name: name, 
        lohn: lohn },
    });
    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    console.error("Fehler bei create-user:", error);
    throw error;
  }
});

ipcMain.handle(
  "add-time-entry",
  async (_event, data: { userId: string; time: number; date: string }) => {
    try {
      const entry = await prisma.timeEntry.create({
        data: {
          userId: data.userId,
          time: data.time,
          date: new Date(data.date),
        },
      });
      return JSON.parse(JSON.stringify(entry));
    } catch (error) {
      console.error("Fehler bei add-time-entry:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "add-ueberweisung",
  async (_event, data: { userId: string; geld: number; date: string }) => {
    try {
      const entry = await prisma.ueberweisung.create({
        data: {
          userId: data.userId,
          geld: data.geld,
          date: new Date(data.date),
        },
      });
      return JSON.parse(JSON.stringify(entry));
    } catch (error) {
      console.error("Fehler bei add-ueberweisung:", error);
      throw error;
    }
  },
);

ipcMain.handle("delete-user", async (_event, userId: string) => {
  try {
    const entry = await prisma.user.delete({
      where: { id: userId },
    });
    return JSON.parse(JSON.stringify(entry));
  } catch (error) {
    console.error("Fehler bei delete-user:", error);
    throw error;
  }
});

ipcMain.handle("get-user-transactions", async (_event, userId: string) => {
  try {
    // search user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lohn: true },
    });

    if (!user) return [];

    // load entrys
    const timeEntries = await prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
    const ueberweisungen = await prisma.ueberweisung.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    // merge format
    const formattedTimeEntries = timeEntries.map((e) => ({
      id: e.id,
      type: "WORK",
      description: `Arbeitszeit (${e.time} Std.)`,
      amountInEuro: e.time * user.lohn, // Stunden in € umrechnen
      date: e.date,
    }));

    const formattedUeberweisungen = ueberweisungen.map((u) => ({
      id: u.id,
      type: "PAYMENT",
      description: "Auszahlung",
      amountInEuro: -u.geld,
      date: u.date,
    }));

    // sort by date
    const allTransactions = [
      ...formattedTimeEntries,
      ...formattedUeberweisungen,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return JSON.parse(JSON.stringify(allTransactions));
  } catch (error) {
    console.error("Fehler beim Laden der Transaktionen:", error);
    return [];
  }
});

ipcMain.handle("get-user-total-time", async (event, userId) => {
  try {
    const result = await prisma.timeEntry.aggregate({
      where: { userId: userId },
      _sum: { time: true },
    });
    const minus = await prisma.ueberweisung.aggregate({
      where: { userId: userId },
      _sum: { geld: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lohn: true,
      },
    });

    const totalHoursDone = result._sum.time || 0;
    const totalPaidMoney = minus._sum.geld || 0;
    const hourlyWage = user?.lohn || 0;

    const hoursPaidOut = hourlyWage > 0 ? totalPaidMoney / hourlyWage : 0;
    const netTotalHours = totalHoursDone - hoursPaidOut;

    return netTotalHours;
  } catch (error) {
    console.error("Fehler beim Summieren der Stunden:", error);
    return 0;
  }
});
