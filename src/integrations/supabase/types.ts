export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaign_members: {
        Row: {
          campaign_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["campaign_role"]
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["campaign_role"]
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["campaign_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          ruleset_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          ruleset_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          ruleset_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      character_audit_log: {
        Row: {
          character_id: string
          created_at: string
          details: Json | null
          id: string
          summary: string
          user_display_name: string | null
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          details?: Json | null
          id?: string
          summary: string
          user_display_name?: string | null
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          summary?: string
          user_display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          campaign_id: string
          concept: string | null
          created_at: string
          custom_fields: Json
          id: string
          image_url: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          concept?: string | null
          created_at?: string
          custom_fields?: Json
          id?: string
          image_url?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          concept?: string | null
          created_at?: string
          custom_fields?: Json
          id?: string
          image_url?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          campaign_id: string
          character_id: string | null
          character_name: string | null
          created_at: string
          dice: Json
          expression: string
          id: string
          message: string | null
          modifier: number
          total: number
          user_display_name: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          character_name?: string | null
          created_at?: string
          dice?: Json
          expression: string
          id?: string
          message?: string | null
          modifier?: number
          total?: number
          user_display_name?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          character_name?: string | null
          created_at?: string
          dice?: Json
          expression?: string
          id?: string
          message?: string | null
          modifier?: number
          total?: number
          user_display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rulesets: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_notes: {
        Row: {
          author_id: string
          character_id: string
          content: string
          created_at: string
          id: string
          session_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          character_id: string
          content: string
          created_at?: string
          id?: string
          session_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          session_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_text_overrides: {
        Row: {
          key: string
          size: number | null
          text: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          size?: number | null
          text?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          size?: number | null
          text?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      character_cards: {
        Row: {
          id: string | null
          campaign_id: string | null
          owner_id: string | null
          name: string | null
          short_description: string | null
          image_url: string | null
          owner_display_name: string | null
          label: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_character: {
        Args: { _character_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_campaign_member: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      is_campaign_narrator: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      purge_old_dice_rolls: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "narratore" | "giocatore"
      approval_status: "pending" | "approved" | "rejected"
      campaign_role: "narratore" | "giocatore"
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
      app_role: ["admin", "narratore", "giocatore"],
      approval_status: ["pending", "approved", "rejected"],
      campaign_role: ["narratore", "giocatore"],
    },
  },
} as const