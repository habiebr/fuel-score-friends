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
      food_logs: {
        Row: {
          calories: number
          carbs_grams: number | null
          fat_grams: number | null
          food_name: string
          id: string
          logged_at: string
          meal_type: string
          protein_grams: number | null
          serving_size: string | null
          user_id: string
        }
        Insert: {
          calories: number
          carbs_grams?: number | null
          fat_grams?: number | null
          food_name: string
          id?: string
          logged_at?: string
          meal_type: string
          protein_grams?: number | null
          serving_size?: string | null
          user_id: string
        }
        Update: {
          calories?: number
          carbs_grams?: number | null
          fat_grams?: number | null
          food_name?: string
          id?: string
          logged_at?: string
          meal_type?: string
          protein_grams?: number | null
          serving_size?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_scores: {
        Row: {
          calories_consumed: number | null
          carbs_grams: number | null
          created_at: string
          daily_score: number
          date: string
          fat_grams: number | null
          id: string
          meals_logged: number | null
          protein_grams: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories_consumed?: number | null
          carbs_grams?: number | null
          created_at?: string
          daily_score?: number
          date?: string
          fat_grams?: number | null
          id?: string
          meals_logged?: number | null
          protein_grams?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calories_consumed?: number | null
          carbs_grams?: number | null
          created_at?: string
          daily_score?: number
          date?: string
          fat_grams?: number | null
          id?: string
          meals_logged?: number | null
          protein_grams?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          created_at: string
          display_name: string | null
          fitness_goals: string[] | null
          height: number | null
          id: string
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          created_at?: string
          display_name?: string | null
          fitness_goals?: string[] | null
          height?: number | null
          id?: string
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          created_at?: string
          display_name?: string | null
          fitness_goals?: string[] | null
          height?: number | null
          id?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      wearable_data: {
        Row: {
          active_minutes: number | null
          activity_type: string | null
          avg_cadence: number | null
          avg_power: number | null
          avg_temperature: number | null
          calories_burned: number | null
          created_at: string
          date: string
          detailed_metrics: Json | null
          distance_meters: number | null
          elevation_gain: number | null
          gps_data: Json | null
          heart_rate_avg: number | null
          heart_rate_zones: Json | null
          id: string
          max_heart_rate: number | null
          max_speed: number | null
          recovery_time: number | null
          sleep_hours: number | null
          steps: number | null
          training_effect: number | null
          user_id: string
        }
        Insert: {
          active_minutes?: number | null
          activity_type?: string | null
          avg_cadence?: number | null
          avg_power?: number | null
          avg_temperature?: number | null
          calories_burned?: number | null
          created_at?: string
          date?: string
          detailed_metrics?: Json | null
          distance_meters?: number | null
          elevation_gain?: number | null
          gps_data?: Json | null
          heart_rate_avg?: number | null
          heart_rate_zones?: Json | null
          id?: string
          max_heart_rate?: number | null
          max_speed?: number | null
          recovery_time?: number | null
          sleep_hours?: number | null
          steps?: number | null
          training_effect?: number | null
          user_id: string
        }
        Update: {
          active_minutes?: number | null
          activity_type?: string | null
          avg_cadence?: number | null
          avg_power?: number | null
          avg_temperature?: number | null
          calories_burned?: number | null
          created_at?: string
          date?: string
          detailed_metrics?: Json | null
          distance_meters?: number | null
          elevation_gain?: number | null
          gps_data?: Json | null
          heart_rate_avg?: number | null
          heart_rate_zones?: Json | null
          id?: string
          max_heart_rate?: number | null
          max_speed?: number | null
          recovery_time?: number | null
          sleep_hours?: number | null
          steps?: number | null
          training_effect?: number | null
          user_id?: string
        }
        Relationships: []
      }
      wearable_laps: {
        Row: {
          avg_heart_rate: number | null
          avg_speed: number | null
          calories: number | null
          created_at: string
          id: string
          lap_index: number
          max_heart_rate: number | null
          start_time: string
          total_distance: number | null
          total_time: number | null
          user_id: string
          wearable_data_id: string | null
        }
        Insert: {
          avg_heart_rate?: number | null
          avg_speed?: number | null
          calories?: number | null
          created_at?: string
          id?: string
          lap_index: number
          max_heart_rate?: number | null
          start_time: string
          total_distance?: number | null
          total_time?: number | null
          user_id: string
          wearable_data_id?: string | null
        }
        Update: {
          avg_heart_rate?: number | null
          avg_speed?: number | null
          calories?: number | null
          created_at?: string
          id?: string
          lap_index?: number
          max_heart_rate?: number | null
          start_time?: string
          total_distance?: number | null
          total_time?: number | null
          user_id?: string
          wearable_data_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wearable_laps_wearable_data_id_fkey"
            columns: ["wearable_data_id"]
            isOneToOne: false
            referencedRelation: "wearable_data"
            referencedColumns: ["id"]
          },
        ]
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
