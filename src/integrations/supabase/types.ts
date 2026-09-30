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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          priority: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      funnel_visual_config: {
        Row: {
          aliases: string[]
          created_at: string | null
          id: string
          ordem: number
          pipeline: string
          stage: string
          visivel: boolean
        }
        Insert: {
          aliases?: string[]
          created_at?: string | null
          id?: string
          ordem: number
          pipeline: string
          stage: string
          visivel?: boolean
        }
        Update: {
          aliases?: string[]
          created_at?: string | null
          id?: string
          ordem?: number
          pipeline?: string
          stage?: string
          visivel?: boolean
        }
        Relationships: []
      }
      ghl_notes_cache: {
        Row: {
          contact_id: string
          fetched_at: string
          notes: Json
        }
        Insert: {
          contact_id: string
          fetched_at?: string
          notes?: Json
        }
        Update: {
          contact_id?: string
          fetched_at?: string
          notes?: Json
        }
        Relationships: []
      }
      meta_creative_cache: {
        Row: {
          ad_id: string
          ad_name: string
          ad_status: string | null
          spend_last_30d: number | null
          updated_at: string
        }
        Insert: {
          ad_id: string
          ad_name: string
          ad_status?: string | null
          spend_last_30d?: number | null
          updated_at?: string
        }
        Update: {
          ad_id?: string
          ad_name?: string
          ad_status?: string | null
          spend_last_30d?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_insights_daily: {
        Row: {
          ad_id: string
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          cost_per_lead: number | null
          cpm: number | null
          ctr: number | null
          date: string
          frequency: number | null
          impressions: number | null
          landing_page_views: number | null
          leads: number | null
          reach: number | null
          spend: number | null
          updated_at: string
        }
        Insert: {
          ad_id: string
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          cost_per_lead?: number | null
          cpm?: number | null
          ctr?: number | null
          date: string
          frequency?: number | null
          impressions?: number | null
          landing_page_views?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
          updated_at?: string
        }
        Update: {
          ad_id?: string
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          cost_per_lead?: number | null
          cpm?: number | null
          ctr?: number | null
          date?: string
          frequency?: number | null
          impressions?: number | null
          landing_page_views?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_objectives: {
        Row: {
          budget_alvo: number
          created_at: string | null
          fechos_alvo: number
          id: string
          leads_alvo: number
          mes: string
          oferta: string
          pre_aprovacao_alvo: number | null
          revenue_alvo: number
          sqls_alvo: number
        }
        Insert: {
          budget_alvo?: number
          created_at?: string | null
          fechos_alvo?: number
          id?: string
          leads_alvo?: number
          mes: string
          oferta: string
          pre_aprovacao_alvo?: number | null
          revenue_alvo?: number
          sqls_alvo?: number
        }
        Update: {
          budget_alvo?: number
          created_at?: string | null
          fechos_alvo?: number
          id?: string
          leads_alvo?: number
          mes?: string
          oferta?: string
          pre_aprovacao_alvo?: number | null
          revenue_alvo?: number
          sqls_alvo?: number
        }
        Relationships: []
      }
      pipeline_stage_configs: {
        Row: {
          created_at: string | null
          id: string
          pipeline_name: string
          position: number
          rule_params: Json
          rule_type: string
          stage_key: string
          stage_label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pipeline_name: string
          position: number
          rule_params?: Json
          rule_type: string
          stage_key: string
          stage_label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pipeline_name?: string
          position?: number
          rule_params?: Json
          rule_type?: string
          stage_key?: string
          stage_label?: string
        }
        Relationships: []
      }
      sales_playbooks: {
        Row: {
          content: string
          created_at: string
          id: string
          pipeline: string
          source_doc_id: string | null
          source_url: string | null
          synced_at: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          pipeline: string
          source_doc_id?: string | null
          source_url?: string | null
          synced_at?: string
          title?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pipeline?: string
          source_doc_id?: string | null
          source_url?: string | null
          synced_at?: string
          title?: string
        }
        Relationships: []
      }
      source_mapping: {
        Row: {
          canal_dashboard: string
          created_at: string | null
          fonte_crm: string
          id: string
          tipo: string
        }
        Insert: {
          canal_dashboard: string
          created_at?: string | null
          fonte_crm: string
          id?: string
          tipo: string
        }
        Update: {
          canal_dashboard?: string
          created_at?: string | null
          fonte_crm?: string
          id?: string
          tipo?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
