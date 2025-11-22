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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string
          avg_hr: number | null
          avg_pace_min_per_km: number | null
          calories: number | null
          created_at: string
          distance_meters: number | null
          duration_seconds: number
          elevation_gain_m: number | null
          fit_file_path: string | null
          id: string
          max_hr: number | null
          notes: string | null
          perceived_exertion: number | null
          sport_type: string
          start_time: string
          training_effect_aerobic: number | null
          training_effect_anaerobic: number | null
          training_load: number | null
          user_id: string
        }
        Insert: {
          activity_date: string
          avg_hr?: number | null
          avg_pace_min_per_km?: number | null
          calories?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds: number
          elevation_gain_m?: number | null
          fit_file_path?: string | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          perceived_exertion?: number | null
          sport_type: string
          start_time: string
          training_effect_aerobic?: number | null
          training_effect_anaerobic?: number | null
          training_load?: number | null
          user_id: string
        }
        Update: {
          activity_date?: string
          avg_hr?: number | null
          avg_pace_min_per_km?: number | null
          calories?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number
          elevation_gain_m?: number | null
          fit_file_path?: string | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          perceived_exertion?: number | null
          sport_type?: string
          start_time?: string
          training_effect_aerobic?: number | null
          training_effect_anaerobic?: number | null
          training_load?: number | null
          user_id?: string
        }
        Relationships: []
      }
      activity_laps: {
        Row: {
          activity_id: string
          avg_hr: number | null
          avg_pace_min_per_km: number | null
          distance_meters: number | null
          duration_seconds: number | null
          elevation_gain_m: number | null
          id: string
          lap_number: number
          max_hr: number | null
        }
        Insert: {
          activity_id: string
          avg_hr?: number | null
          avg_pace_min_per_km?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          id?: string
          lap_number: number
          max_hr?: number | null
        }
        Update: {
          activity_id?: string
          avg_hr?: number | null
          avg_pace_min_per_km?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          id?: string
          lap_number?: number
          max_hr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_laps_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_preferences: {
        Row: {
          agent_builtin_id: string | null
          agent_id: string | null
          created_at: string
          is_enabled: boolean
          sort_order: number
          user_id: string
        }
        Insert: {
          agent_builtin_id?: string | null
          agent_id?: string | null
          created_at?: string
          is_enabled?: boolean
          sort_order?: number
          user_id: string
        }
        Update: {
          agent_builtin_id?: string | null
          agent_id?: string | null
          created_at?: string
          is_enabled?: boolean
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_nudges: {
        Row: {
          action_taken: string | null
          created_at: string
          domain: string
          id: string
          is_read: boolean
          message: string | null
          nudge_time: string
          nudge_type: string | null
          priority: number | null
          title: string | null
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_read?: boolean
          message?: string | null
          nudge_time?: string
          nudge_type?: string | null
          priority?: number | null
          title?: string | null
          user_id: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_read?: boolean
          message?: string | null
          nudge_time?: string
          nudge_type?: string | null
          priority?: number | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          model_used: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_used?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model_used?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          body_battery_charged: number | null
          body_battery_drained: number | null
          body_battery_end: number | null
          body_battery_start: number | null
          calories_active: number | null
          calories_total: number | null
          created_at: string
          date: string
          floors_climbed: number | null
          hrv_sdnn_ms: number | null
          id: string
          intensity_minutes_moderate: number | null
          intensity_minutes_vigorous: number | null
          resting_hr: number | null
          steps: number | null
          stress_avg: number | null
          stress_max: number | null
          training_load_acute: number | null
          training_load_chronic: number | null
          training_status: string | null
          updated_at: string
          user_id: string
          vo2max: number | null
        }
        Insert: {
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          body_battery_end?: number | null
          body_battery_start?: number | null
          calories_active?: number | null
          calories_total?: number | null
          created_at?: string
          date: string
          floors_climbed?: number | null
          hrv_sdnn_ms?: number | null
          id?: string
          intensity_minutes_moderate?: number | null
          intensity_minutes_vigorous?: number | null
          resting_hr?: number | null
          steps?: number | null
          stress_avg?: number | null
          stress_max?: number | null
          training_load_acute?: number | null
          training_load_chronic?: number | null
          training_status?: string | null
          updated_at?: string
          user_id: string
          vo2max?: number | null
        }
        Update: {
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          body_battery_end?: number | null
          body_battery_start?: number | null
          calories_active?: number | null
          calories_total?: number | null
          created_at?: string
          date?: string
          floors_climbed?: number | null
          hrv_sdnn_ms?: number | null
          id?: string
          intensity_minutes_moderate?: number | null
          intensity_minutes_vigorous?: number | null
          resting_hr?: number | null
          steps?: number | null
          stress_avg?: number | null
          stress_max?: number | null
          training_load_acute?: number | null
          training_load_chronic?: number | null
          training_status?: string | null
          updated_at?: string
          user_id?: string
          vo2max?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string
          embedding: string | null
          id: number
          metadata: Json | null
          project_name: string | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
          project_name?: string | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
          project_name?: string | null
        }
        Relationships: []
      }
      finance_accounts: {
        Row: {
          account_type: string
          balance: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_bills: {
        Row: {
          amount: number
          billing_account_id: string | null
          category: string | null
          charge_cycle: string
          company_name: string
          created_at: string
          id: string
          is_active: boolean
          next_due_date: string
          notes: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_account_id?: string | null
          category?: string | null
          charge_cycle: string
          company_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          next_due_date: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_account_id?: string | null
          category?: string | null
          charge_cycle?: string
          company_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          next_due_date?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_bills_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_monthly_snapshots: {
        Row: {
          account_balances: Json
          bill_statuses: Json
          cash_flow_data: Json | null
          created_at: string
          id: string
          month_year: string
          notes: string | null
          snapshot_date: string
          user_id: string
        }
        Insert: {
          account_balances: Json
          bill_statuses: Json
          cash_flow_data?: Json | null
          created_at?: string
          id?: string
          month_year: string
          notes?: string | null
          snapshot_date: string
          user_id: string
        }
        Update: {
          account_balances?: Json
          bill_statuses?: Json
          cash_flow_data?: Json | null
          created_at?: string
          id?: string
          month_year?: string
          notes?: string | null
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_projections: {
        Row: {
          account_balances: Json
          bills_amount: number
          bills_remaining: number
          cash_available: number
          cash_per_week: number | null
          created_at: string
          days_remaining: number
          id: string
          notes: string | null
          projection_date: string
          spending_per_day: number | null
          total_available: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_balances: Json
          bills_amount?: number
          bills_remaining: number
          cash_available: number
          cash_per_week?: number | null
          created_at?: string
          days_remaining: number
          id?: string
          notes?: string | null
          projection_date: string
          spending_per_day?: number | null
          total_available: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_balances?: Json
          bills_amount?: number
          bills_remaining?: number
          cash_available?: number
          cash_per_week?: number | null
          created_at?: string
          days_remaining?: number
          id?: string
          notes?: string | null
          projection_date?: string
          spending_per_day?: number | null
          total_available?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          account_id: string
          amount: number
          bill_id: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          is_recurring: boolean
          notes: string | null
          transaction_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          bill_id?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          transaction_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          bill_id?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          transaction_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "finance_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      health_profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          dietary_preferences: Json | null
          height_cm: number | null
          medical_conditions: Json | null
          sex: string | null
          timezone: string | null
          training_modality: string[] | null
          updated_at: string
          user_id: string
          weekly_availability_hours: number | null
          weight_goal_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          dietary_preferences?: Json | null
          height_cm?: number | null
          medical_conditions?: Json | null
          sex?: string | null
          timezone?: string | null
          training_modality?: string[] | null
          updated_at?: string
          user_id: string
          weekly_availability_hours?: number | null
          weight_goal_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          dietary_preferences?: Json | null
          height_cm?: number | null
          medical_conditions?: Json | null
          sex?: string | null
          timezone?: string | null
          training_modality?: string[] | null
          updated_at?: string
          user_id?: string
          weekly_availability_hours?: number | null
          weight_goal_kg?: number | null
        }
        Relationships: []
      }
      hydration_logs: {
        Row: {
          amount_ml: number
          created_at: string
          drink_type: string | null
          id: string
          log_date: string
          log_time: string | null
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          drink_type?: string | null
          id?: string
          log_date: string
          log_time?: string | null
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          drink_type?: string | null
          id?: string
          log_date?: string
          log_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          inserted_rows: number | null
          object_key: string
          processed_files: number | null
          source: string
          started_at: string | null
          status: string
          total_files: number | null
          updated_rows: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          inserted_rows?: number | null
          object_key: string
          processed_files?: number | null
          source: string
          started_at?: string | null
          status?: string
          total_files?: number | null
          updated_rows?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          inserted_rows?: number | null
          object_key?: string
          processed_files?: number | null
          source?: string
          started_at?: string | null
          status?: string
          total_files?: number | null
          updated_rows?: number | null
          user_id?: string
        }
        Relationships: []
      }
      memories_daily: {
        Row: {
          created_at: string
          flagged_concerns: string[] | null
          goals_progress: Json | null
          id: string
          key_insights: Json | null
          memory_date: string
          nutrition_summary: Json | null
          readiness_score: number | null
          sleep_quality: string | null
          stress_level: string | null
          summary_long: string | null
          summary_short: string | null
          training_recommendation: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          flagged_concerns?: string[] | null
          goals_progress?: Json | null
          id?: string
          key_insights?: Json | null
          memory_date: string
          nutrition_summary?: Json | null
          readiness_score?: number | null
          sleep_quality?: string | null
          stress_level?: string | null
          summary_long?: string | null
          summary_short?: string | null
          training_recommendation?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          flagged_concerns?: string[] | null
          goals_progress?: Json | null
          id?: string
          key_insights?: Json | null
          memory_date?: string
          nutrition_summary?: Json | null
          readiness_score?: number | null
          sleep_quality?: string | null
          stress_level?: string | null
          summary_long?: string | null
          summary_short?: string | null
          training_recommendation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          name: string | null
          role: string
          tool_invocations: Json | null
          tool_result: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          role: string
          tool_invocations?: Json | null
          tool_result?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          role?: string
          tool_invocations?: Json | null
          tool_result?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_entries: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          entry_date: string
          fat_g: number | null
          food_description: string | null
          id: string
          meal_time: string | null
          meal_type: string | null
          photo_url: string | null
          protein_g: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          entry_date: string
          fat_g?: number | null
          food_description?: string | null
          id?: string
          meal_time?: string | null
          meal_type?: string | null
          photo_url?: string | null
          protein_g?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          entry_date?: string
          fat_g?: number | null
          food_description?: string | null
          id?: string
          meal_time?: string | null
          meal_type?: string | null
          photo_url?: string | null
          protein_g?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sleep_sessions: {
        Row: {
          avg_hr: number | null
          avg_hrv: number | null
          avg_respiration_rate: number | null
          awake_time_hrs: number | null
          created_at: string
          deep_sleep_hrs: number | null
          duration_hrs: number | null
          end_time: string
          id: string
          light_sleep_hrs: number | null
          rem_sleep_hrs: number | null
          sleep_date: string
          sleep_score: number | null
          start_time: string
          user_id: string
        }
        Insert: {
          avg_hr?: number | null
          avg_hrv?: number | null
          avg_respiration_rate?: number | null
          awake_time_hrs?: number | null
          created_at?: string
          deep_sleep_hrs?: number | null
          duration_hrs?: number | null
          end_time: string
          id?: string
          light_sleep_hrs?: number | null
          rem_sleep_hrs?: number | null
          sleep_date: string
          sleep_score?: number | null
          start_time: string
          user_id: string
        }
        Update: {
          avg_hr?: number | null
          avg_hrv?: number | null
          avg_respiration_rate?: number | null
          awake_time_hrs?: number | null
          created_at?: string
          deep_sleep_hrs?: number | null
          duration_hrs?: number | null
          end_time?: string
          id?: string
          light_sleep_hrs?: number | null
          rem_sleep_hrs?: number | null
          sleep_date?: string
          sleep_score?: number | null
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      user_agents: {
        Row: {
          color_hex: string | null
          content: string
          created_at: string
          description: string | null
          icon_key: string | null
          id: string
          is_builtin: boolean
          name: string
          user_id: string
        }
        Insert: {
          color_hex?: string | null
          content: string
          created_at?: string
          description?: string | null
          icon_key?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          user_id: string
        }
        Update: {
          color_hex?: string | null
          content?: string
          created_at?: string
          description?: string | null
          icon_key?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          ai_personality: Json | null
          coaching_goals: Json | null
          created_at: string
          data_sharing_preferences: Json | null
          enabled_domains: string[] | null
          nudge_settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_personality?: Json | null
          coaching_goals?: Json | null
          created_at?: string
          data_sharing_preferences?: Json | null
          enabled_domains?: string[] | null
          nudge_settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_personality?: Json | null
          coaching_goals?: Json | null
          created_at?: string
          data_sharing_preferences?: Json | null
          enabled_domains?: string[] | null
          nudge_settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          invitation_id: string | null
          is_active: boolean
          registered_via: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          invitation_id?: string | null
          is_active?: boolean
          registered_via?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invitation_id?: string | null
          is_active?: boolean
          registered_via?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          log_date: string
          muscle_mass_kg: number | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          log_date: string
          muscle_mass_kg?: number | null
          user_id: string
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          log_date?: string
          muscle_mass_kg?: number | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_daily_readiness: {
        Row: {
          body_battery_start: number | null
          date: string | null
          hrv_sdnn_ms: number | null
          injury_risk: string | null
          readiness_score: number | null
          sleep_score: number | null
          stress_avg: number | null
          training_status: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assert_caller: { Args: { p_user_id: string }; Returns: undefined }
      batch_upsert_agent_preferences: {
        Args: { p_items: Json; p_user_id: string }
        Returns: undefined
      }
      get_readiness_score: {
        Args: { p_date: string; p_user_id: string }
        Returns: Json
      }
      insert_activity_with_laps: {
        Args: { p_activity: Json; p_laps: Json; p_user_id: string }
        Returns: string
      }
      insert_daily_metrics_batch: {
        Args: { p_metrics: Json; p_user_id: string }
        Returns: Json
      }
      insert_nutrition_entry: {
        Args: { p_entry: Json; p_user_id: string }
        Returns: string
      }
      list_user_agents: { Args: { p_user_id: string }; Returns: Json }
      register_import_job: {
        Args: { p_object_key: string; p_source: string; p_user_id: string }
        Returns: string
      }
      upsert_agent_preference: {
        Args: {
          p_agent_builtin_id: string
          p_agent_id: string
          p_is_enabled: boolean
          p_sort_order: number
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_daily_memory: {
        Args: { p_memory: Json; p_user_id: string }
        Returns: string
      }
      upsert_sleep_session: {
        Args: { p_sleep: Json; p_user_id: string }
        Returns: string
      }
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
