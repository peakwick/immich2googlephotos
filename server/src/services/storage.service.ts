import fs from 'fs';
import path from 'path';
import { StoredSettings, MigrationRecord, MigrationSession } from '../types';

export class StorageService {
  private dataDir: string;
  private settingsFile: string;
  private historyFile: string;
  private sessionsFile: string;

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../data');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    this.historyFile = path.join(this.dataDir, 'migration_history.json');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.ensureFiles();
  }

  private ensureFiles(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.settingsFile)) {
      const defaultSettings: StoredSettings = {
        immichUrl: 'http://localhost:2283',
        immichApiKey: '',
        googleClientId: '',
        googleClientSecret: '',
        googleAccessToken: '',
        googleRefreshToken: '',
      };
      fs.writeFileSync(this.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf-8');
    }

    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify([], null, 2), 'utf-8');
    }

    if (!fs.existsSync(this.sessionsFile)) {
      fs.writeFileSync(this.sessionsFile, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  public getSettings(): StoredSettings {
    try {
      const content = fs.readFileSync(this.settingsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read settings.json, returning defaults:', error);
      return {
        immichUrl: 'http://localhost:2283',
        immichApiKey: '',
        googleClientId: '',
        googleClientSecret: '',
        googleAccessToken: '',
        googleRefreshToken: '',
      };
    }
  }

  public saveSettings(partial: Partial<StoredSettings>): StoredSettings {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  public getMigrationRecords(): MigrationRecord[] {
    try {
      const content = fs.readFileSync(this.historyFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read migration_history.json:', error);
      return [];
    }
  }

  public isAssetMigrated(assetId: string): boolean {
    const records = this.getMigrationRecords();
    return records.some((r) => r.assetId === assetId);
  }

  public recordMigration(record: MigrationRecord): void {
    const records = this.getMigrationRecords();
    const filtered = records.filter((r) => r.assetId !== record.assetId);
    filtered.push(record);
    fs.writeFileSync(this.historyFile, JSON.stringify(filtered, null, 2), 'utf-8');
  }

  public clearMigrationHistory(): void {
    fs.writeFileSync(this.historyFile, JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(this.sessionsFile, JSON.stringify([], null, 2), 'utf-8');
  }

  public getSessions(): MigrationSession[] {
    try {
      const content = fs.readFileSync(this.sessionsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read sessions.json:', error);
      return [];
    }
  }

  public saveSession(session: MigrationSession): void {
    const sessions = this.getSessions();
    sessions.push(session);
    fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8');
  }

  public deleteSession(sessionId: string): void {
    // 1. Remove from sessions.json
    const sessions = this.getSessions();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    fs.writeFileSync(this.sessionsFile, JSON.stringify(updatedSessions, null, 2), 'utf-8');

    // 2. Remove all related records from migration_history.json
    const records = this.getMigrationRecords();
    const updatedRecords = records.filter(r => r.sessionId !== sessionId);
    fs.writeFileSync(this.historyFile, JSON.stringify(updatedRecords, null, 2), 'utf-8');
  }
}

export const storageService = new StorageService();
