/**
 * IndexedDB wrapper para drafts de formularios (auto-save).
 *
 * Patrón replicado de agroflow-platform/src/lib/offline/db.ts donde ya
 * resolvieron los dolores de cabeza con sessionStorage/localStorage:
 *   - sessionStorage se borra al cerrar el tab
 *   - localStorage es sync (puede freezear el UI) y tiene 5-10MB hard limit
 *   - IndexedDB es async, persistente, sin límite práctico
 *
 * Solo se carga el módulo `idb` cuando se usa el draft (lazy via import dinámico
 * desde el hook). El export `getDB` mantiene una promesa singleton.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "golf-app-offline";
const DB_VERSION = 1;

export interface FormDraft {
  key: string; // e.g. "pp-session" (única por tipo de form)
  formType: string;
  data: unknown;
  savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("form-drafts")) {
          const store = db.createObjectStore("form-drafts", { keyPath: "key" });
          store.createIndex("by-type", "formType");
          store.createIndex("by-saved", "savedAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveDraft(draft: FormDraft): Promise<void> {
  const db = await getDB();
  await db.put("form-drafts", draft);
}

export async function getDraft(key: string): Promise<FormDraft | undefined> {
  const db = await getDB();
  return db.get("form-drafts", key);
}

export async function deleteDraft(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("form-drafts", key);
}

export async function clearDrafts(): Promise<void> {
  const db = await getDB();
  await db.clear("form-drafts");
}
