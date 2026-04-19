/**
 * database.ts — Types Supabase + modèle de données
 *
 * Utilisé côté client ET serveur.
 * À importer via : import type { Document, Database } from '@/app/lib/types/database'
 */

export type DocumentType   = 'video' | 'audio' | 'doc' | 'image'
export type SlotZone       = 'high' | 'mid' | 'low'
export type SlotOrientation = 'portrait' | 'landscape'

// ── Table : documents ─────────────────────────────────────────────────────────
// Chaque ligne = un fichier stocké sur Cloudflare R2, référencé par son URL publique.

export interface Document {
  id:          string
  created_at:  string
  filename:    string
  title:       string | null
  type:        DocumentType
  subfolder:   string
  url:         string          // URL publique Cloudflare R2
  size_bytes:  number | null
  duration_s:  number | null
}

// ── Table : expositions ───────────────────────────────────────────────────────

export interface ExpositionFrame {
  document_id:  string
  angle:        number
  zone:         SlotZone
  orientation:  SlotOrientation
  title:        string
  author:       string
}

export interface Exposition {
  id:           string
  created_at:   string
  slug:         string
  author_name:  string | null
  frames:       ExpositionFrame[]
  view_count:   number
}

// ── Type Supabase générique ───────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      documents: {
        Row:    Document
        Insert: Omit<Document, 'id' | 'created_at'>
        Update: Partial<Omit<Document, 'id' | 'created_at'>>
      }
      expositions: {
        Row:    Exposition
        Insert: Omit<Exposition, 'id' | 'created_at' | 'view_count'>
        Update: Partial<Omit<Exposition, 'id' | 'created_at'>>
      }
    }
  }
}