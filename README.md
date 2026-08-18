# Stunden-Tracker (Time Tracker)

A lightweight, privacy-focused, cross-platform desktop application designed for tracking working hours, wage calculations, and payments. Built with Electron, TypeScript, and Prisma with SQLite.

---

## Features

* User Management: Create and manage distinct profiles with custom hourly wages.
* Time Tracking: Log work hours linked directly to specific user accounts.
* Payment Management: Track transfers/payments and automatically adjust remaining open balances.
* Automatic Wage Calculation: Real-time conversion of logged hours into earnings based on set rates.
* Privacy-First & Offline: All data is stored locally on your device in a local SQLite database—no external servers or telemetry.

---

## Tech Stack

* Framework: Electron
* Language: TypeScript
* Database & ORM: SQLite via Prisma ORM
* Packaging: electron-builder (NSIS Installer for Windows)

---

## Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
* Node.js (v18 or higher recommended)
* npm
