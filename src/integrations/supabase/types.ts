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
      limits: {
        Row: {
          cleaning_type: Database["public"]["Enums"]["cleaning_type"]
          created_at: string | null
          group_type: Database["public"]["Enums"]["room_group"]
          guest_count: number
          id: string
          time_limit: number
        }
        Insert: {
          cleaning_type: Database["public"]["Enums"]["cleaning_type"]
          created_at?: string | null
          group_type: Database["public"]["Enums"]["room_group"]
          guest_count: number
          id?: string
          time_limit: number
        }
        Update: {
          cleaning_type?: Database["public"]["Enums"]["cleaning_type"]
          created_at?: string | null
          group_type?: Database["public"]["Enums"]["room_group"]
          guest_count?: number
          id?: string
          time_limit?: number
        }
        Relationships: []
      }
      rooms: {
        Row: {
          active: boolean | null
          capacity: number
          cleaning_types: Json | null
          color: string | null
          created_at: string | null
          group_type: Database["public"]["Enums"]["room_group"]
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          capacity?: number
          cleaning_types?: Json | null
          color?: string | null
          created_at?: string | null
          group_type: Database["public"]["Enums"]["room_group"]
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          capacity?: number
          cleaning_types?: Json | null
          color?: string | null
          created_at?: string | null
          group_type?: Database["public"]["Enums"]["room_group"]
          id?: string
          name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_time: number | null
          cleaning_type: Database["public"]["Enums"]["cleaning_type"]
          created_at: string | null
          date: string
          difference: number | null
          guest_count: number
          housekeeping_notes: string | null
          id: string
          issue_description: string | null
          issue_flag: boolean | null
          issue_photo: string | null
          pause_start: string | null
          pause_stop: string | null
          reception_notes: string | null
          room_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          stop_time: string | null
          time_limit: number | null
          total_pause: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual_time?: number | null
          cleaning_type: Database["public"]["Enums"]["cleaning_type"]
          created_at?: string | null
          date?: string
          difference?: number | null
          guest_count?: number
          housekeeping_notes?: string | null
          id?: string
          issue_description?: string | null
          issue_flag?: boolean | null
          issue_photo?: string | null
          pause_start?: string | null
          pause_stop?: string | null
          reception_notes?: string | null
          room_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          stop_time?: string | null
          time_limit?: number | null
          total_pause?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual_time?: number | null
          cleaning_type?: Database["public"]["Enums"]["cleaning_type"]
          created_at?: string | null
          date?: string
          difference?: number | null
          guest_count?: number
          housekeeping_notes?: string | null
          id?: string
          issue_description?: string | null
          issue_flag?: boolean | null
          issue_photo?: string | null
          pause_start?: string | null
          pause_stop?: string | null
          reception_notes?: string | null
          room_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          stop_time?: string | null
          time_limit?: number | null
          total_pause?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean | null
          auth_id: string | null
          created_at: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean | null
          auth_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean | null
          auth_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          break_minutes: number | null
          breakfast_minutes: number | null
          created_at: string | null
          date: string
          id: string
          laundry_minutes: number | null
          notes: string | null
          time_in: string | null
          time_out: string | null
          total_minutes: number | null
          user_id: string | null
        }
        Insert: {
          break_minutes?: number | null
          breakfast_minutes?: number | null
          created_at?: string | null
          date?: string
          id?: string
          laundry_minutes?: number | null
          notes?: string | null
          time_in?: string | null
          time_out?: string | null
          total_minutes?: number | null
          user_id?: string | null
        }
        Update: {
          break_minutes?: number | null
          breakfast_minutes?: number | null
          created_at?: string | null
          date?: string
          id?: string
          laundry_minutes?: number | null
          notes?: string | null
          time_in?: string | null
          time_out?: string | null
          total_minutes?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "reception" | "housekeeping"
      cleaning_type: "W" | "P" | "T" | "O" | "G" | "S"
      room_group: "P1" | "P2" | "A1S" | "A2S" | "OTHER"
      task_status: "todo" | "in_progress" | "paused" | "done" | "repair_needed"
      user_role: "admin" | "reception" | "housekeeping"
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
      app_role: ["admin", "reception", "housekeeping"],
      cleaning_type: ["W", "P", "T", "O", "G", "S"],
      room_group: ["P1", "P2", "A1S", "A2S", "OTHER"],
      task_status: ["todo", "in_progress", "paused", "done", "repair_needed"],
      user_role: ["admin", "reception", "housekeeping"],
    },
  },
} as const
