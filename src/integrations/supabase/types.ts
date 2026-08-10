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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          id: number
          password: string | null
        }
        Insert: {
          id: number
          password?: string | null
        }
        Update: {
          id?: number
          password?: string | null
        }
        Relationships: []
      }
      business_config: {
        Row: {
          id: number
          monthly_cost: number
          monthly_revenue: number
          overhead_factor: number
          updated_at: string
        }
        Insert: {
          id?: number
          monthly_cost?: number
          monthly_revenue?: number
          overhead_factor?: number
          updated_at?: string
        }
        Update: {
          id?: number
          monthly_cost?: number
          monthly_revenue?: number
          overhead_factor?: number
          updated_at?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          base_price: number
          cost_per_m2: number
          family: string
          items_count: number | null
          min_charge: number | null
          notes: string | null
          outsource_area_m2: number | null
          outsource_cost_per_m2: number | null
          qty_discounts: Json | null
          qty_exponent: number
          rate_m2: number | null
        }
        Insert: {
          base_price?: number
          cost_per_m2?: number
          family: string
          items_count?: number | null
          min_charge?: number | null
          notes?: string | null
          outsource_area_m2?: number | null
          outsource_cost_per_m2?: number | null
          qty_discounts?: Json | null
          qty_exponent?: number
          rate_m2?: number | null
        }
        Update: {
          base_price?: number
          cost_per_m2?: number
          family?: string
          items_count?: number | null
          min_charge?: number | null
          notes?: string | null
          outsource_area_m2?: number | null
          outsource_cost_per_m2?: number | null
          qty_discounts?: Json | null
          qty_exponent?: number
          rate_m2?: number | null
        }
        Relationships: []
      }
      product_history: {
        Row: {
          batch_id: string
          changed_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          product_id: string
          source: string
        }
        Insert: {
          batch_id: string
          changed_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          product_id: string
          source?: string
        }
        Update: {
          batch_id?: string
          changed_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          product_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_notes: {
        Row: {
          author: string | null
          body: string
          created_at: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          body: string
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          body?: string
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_notes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          anomaly: string | null
          competitor_price: number | null
          competitor_ref: string | null
          created_at: string | null
          family: string | null
          final_price: number | null
          height_cm: number | null
          id: string
          is_anchor: boolean
          name: string
          notes: string | null
          proposed_price: number | null
          qty: number | null
          row_key: string
          senzey_dup_count: number | null
          senzey_exists: boolean | null
          senzey_group: string | null
          senzey_ids: string | null
          senzey_price: number | null
          senzey_status: string | null
          site_category: string | null
          site_exists: boolean | null
          site_price: number | null
          site_status: string | null
          site_url: string | null
          source: string | null
          updated_at: string | null
          verified: boolean
          verified_at: string | null
          width_cm: number | null
        }
        Insert: {
          anomaly?: string | null
          competitor_price?: number | null
          competitor_ref?: string | null
          created_at?: string | null
          family?: string | null
          final_price?: number | null
          height_cm?: number | null
          id?: string
          is_anchor?: boolean
          name: string
          notes?: string | null
          proposed_price?: number | null
          qty?: number | null
          row_key: string
          senzey_dup_count?: number | null
          senzey_exists?: boolean | null
          senzey_group?: string | null
          senzey_ids?: string | null
          senzey_price?: number | null
          senzey_status?: string | null
          site_category?: string | null
          site_exists?: boolean | null
          site_price?: number | null
          site_status?: string | null
          site_url?: string | null
          source?: string | null
          updated_at?: string | null
          verified?: boolean
          verified_at?: string | null
          width_cm?: number | null
        }
        Update: {
          anomaly?: string | null
          competitor_price?: number | null
          competitor_ref?: string | null
          created_at?: string | null
          family?: string | null
          final_price?: number | null
          height_cm?: number | null
          id?: string
          is_anchor?: boolean
          name?: string
          notes?: string | null
          proposed_price?: number | null
          qty?: number | null
          row_key?: string
          senzey_dup_count?: number | null
          senzey_exists?: boolean | null
          senzey_group?: string | null
          senzey_ids?: string | null
          senzey_price?: number | null
          senzey_status?: string | null
          site_category?: string | null
          site_exists?: boolean | null
          site_price?: number | null
          site_status?: string | null
          site_url?: string | null
          source?: string | null
          updated_at?: string | null
          verified?: boolean
          verified_at?: string | null
          width_cm?: number | null
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
