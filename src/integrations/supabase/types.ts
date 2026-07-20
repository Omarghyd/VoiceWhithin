export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          approved_voice: Json
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          pending_voice: Json | null
          size: Database["public"]["Enums"]["company_size"]
          updated_at: string
          voice_status: string
        }
        Insert: {
          approved_voice?: Json
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
          pending_voice?: Json | null
          size?: Database["public"]["Enums"]["company_size"]
          updated_at?: string
          voice_status?: string
        }
        Update: {
          approved_voice?: Json
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
          pending_voice?: Json | null
          size?: Database["public"]["Enums"]["company_size"]
          updated_at?: string
          voice_status?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_tastes: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      lending_drafts: {
        Row: {
          brief: string
          collaborator_id: string
          created_at: string
          decided_at: string | null
          draft_text: string
          grant_id: string
          id: string
          owner_id: string
          owner_note: string | null
          status: string
        }
        Insert: {
          brief: string
          collaborator_id: string
          created_at?: string
          decided_at?: string | null
          draft_text: string
          grant_id: string
          id?: string
          owner_id: string
          owner_note?: string | null
          status?: string
        }
        Update: {
          brief?: string
          collaborator_id?: string
          created_at?: string
          decided_at?: string | null
          draft_text?: string
          grant_id?: string
          id?: string
          owner_id?: string
          owner_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lending_drafts_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "lending_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      lending_grants: {
        Row: {
          activated_at: string | null
          autonomy: string
          collaborator_email: string
          collaborator_id: string | null
          created_at: string
          id: string
          owner_id: string
          relationship_label: string
          revoked_at: string | null
          scope: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          autonomy?: string
          collaborator_email: string
          collaborator_id?: string | null
          created_at?: string
          id?: string
          owner_id: string
          relationship_label?: string
          revoked_at?: string | null
          scope?: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          autonomy?: string
          collaborator_email?: string
          collaborator_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          relationship_label?: string
          revoked_at?: string | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teams_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          created_at: string
          id: string
          period_start: string
          tokens_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_start: string
          tokens_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_start?: string
          tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_voice_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          drafts_since_check: number
          is_public: boolean
          memory: Json
          observations: Json
          opening: string
          published_at: string | null
          signature_passage: string | null
          slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          drafts_since_check?: number
          is_public?: boolean
          memory?: Json
          observations?: Json
          opening?: string
          published_at?: string | null
          signature_passage?: string | null
          slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          drafts_since_check?: number
          is_public?: boolean
          memory?: Json
          observations?: Json
          opening?: string
          published_at?: string | null
          signature_passage?: string | null
          slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_feedback: {
        Row: {
          brief: string
          chosen_text: string
          company_id: string
          created_at: string
          id: string
          learned: string | null
          other_texts: Json
          reason: string | null
          user_id: string
        }
        Insert: {
          brief: string
          chosen_text: string
          company_id: string
          created_at?: string
          id?: string
          learned?: string | null
          other_texts?: Json
          reason?: string | null
          user_id: string
        }
        Update: {
          brief?: string
          chosen_text?: string
          company_id?: string
          created_at?: string
          id?: string
          learned?: string | null
          other_texts?: Json
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_materials: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          kind: string
          title: string
          uploaded_by: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
          uploaded_by: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_updates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          id: string
          proposal: Json
          rationale: string | null
          status: Database["public"]["Enums"]["voice_update_status"]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposal: Json
          rationale?: string | null
          status?: Database["public"]["Enums"]["voice_update_status"]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposal?: Json
          rationale?: string | null
          status?: Database["public"]["Enums"]["voice_update_status"]
        }
        Relationships: [
          {
            foreignKeyName: "voice_updates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_voice_slug: { Args: never; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      company_size: "individual" | "1-5" | "6-20" | "21-100" | "100+"
      member_role: "owner" | "steward" | "member"
      voice_update_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      company_size: ["individual", "1-5", "6-20", "21-100", "100+"],
      member_role: ["owner", "steward", "member"],
      voice_update_status: ["pending", "approved", "rejected"],
    },
  },
} as const
