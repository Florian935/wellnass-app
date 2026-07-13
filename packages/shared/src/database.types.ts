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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      body_weight_entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          log_date: string
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          log_date: string
          updated_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      exercise_favorites: {
        Row: {
          created_at: string
          deleted_at: string | null
          exercise_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_favorites_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_plans: {
        Row: {
          created_at: string
          deleted_at: string | null
          exercise_id: string
          id: string
          order_index: number
          owner_id: string | null
          rest_seconds: number | null
          session_id: string
          set_type: string
          target_reps: string | null
          target_sets: number | null
          target_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          id: string
          order_index?: number
          owner_id?: string | null
          rest_seconds?: number | null
          session_id: string
          set_type?: string
          target_reps?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          id?: string
          order_index?: number
          owner_id?: string | null
          rest_seconds?: number | null
          session_id?: string
          set_type?: string
          target_reps?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_plans_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_translations: {
        Row: {
          created_at: string
          deleted_at: string | null
          exercise_id: string
          id: string
          instructions: string | null
          lang: string
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          id: string
          instructions?: string | null
          lang: string
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          id?: string
          instructions?: string | null
          lang?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_translations_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          deleted_at: string | null
          equipment: string | null
          id: string
          media_url: string | null
          muscle_primary: string
          owner_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          equipment?: string | null
          id: string
          media_url?: string | null
          muscle_primary: string
          owner_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          equipment?: string | null
          id?: string
          media_url?: string | null
          muscle_primary?: string
          owner_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          carbs_g: number
          created_at: string
          deleted_at: string | null
          fat_g: number
          food_id: string | null
          id: string
          kcal: number
          log_date: string
          meal_type: string
          micronutrients: Json
          name: string
          order_index: number
          protein_g: number
          quantity_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          deleted_at?: string | null
          fat_g?: number
          food_id?: string | null
          id: string
          kcal?: number
          log_date: string
          meal_type: string
          micronutrients?: Json
          name: string
          order_index?: number
          protein_g?: number
          quantity_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          deleted_at?: string | null
          fat_g?: number
          food_id?: string | null
          id?: string
          kcal?: number
          log_date?: string
          meal_type?: string
          micronutrients?: Json
          name?: string
          order_index?: number
          protein_g?: number
          quantity_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_favorites: {
        Row: {
          created_at: string
          deleted_at: string | null
          food_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          food_id: string
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          food_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_favorites_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_translations: {
        Row: {
          created_at: string
          deleted_at: string | null
          food_id: string
          id: string
          lang: string
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          food_id: string
          id: string
          lang: string
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          food_id?: string
          id?: string
          lang?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_translations_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          barcode: string | null
          carbs_per_100g: number | null
          category: string
          created_at: string
          deleted_at: string | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          id: string
          import_key: string | null
          kcal_per_100g: number
          micronutrients: Json
          owner_id: string | null
          portions: Json
          protein_per_100g: number | null
          saturated_fat_per_100g: number | null
          source: string
          sugars_per_100g: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          carbs_per_100g?: number | null
          category: string
          created_at?: string
          deleted_at?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id: string
          import_key?: string | null
          kcal_per_100g: number
          micronutrients?: Json
          owner_id?: string | null
          portions?: Json
          protein_per_100g?: number | null
          saturated_fat_per_100g?: number | null
          source?: string
          sugars_per_100g?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          carbs_per_100g?: number | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          import_key?: string | null
          kcal_per_100g?: number
          micronutrients?: Json
          owner_id?: string | null
          portions?: Json
          protein_per_100g?: number | null
          saturated_fat_per_100g?: number | null
          source?: string
          sugars_per_100g?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      meal_template_items: {
        Row: {
          carbs_g: number
          created_at: string
          deleted_at: string | null
          fat_g: number
          food_id: string | null
          id: string
          kcal: number
          name: string
          protein_g: number
          quantity_g: number | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          deleted_at?: string | null
          fat_g?: number
          food_id?: string | null
          id: string
          kcal?: number
          name: string
          protein_g?: number
          quantity_g?: number | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          deleted_at?: string | null
          fat_g?: number
          food_id?: string | null
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
          quantity_g?: number | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_template_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_profiles: {
        Row: {
          activity_level: string
          allergens: Json
          created_at: string
          deleted_at: string | null
          id: string
          manual_calories: number | null
          manual_carbs_g: number | null
          manual_fat_g: number | null
          manual_protein_g: number | null
          meals: Json | null
          objective: string | null
          restrictions: Json
          training_day_bonus: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_level?: string
          allergens?: Json
          created_at?: string
          deleted_at?: string | null
          id: string
          manual_calories?: number | null
          manual_carbs_g?: number | null
          manual_fat_g?: number | null
          manual_protein_g?: number | null
          meals?: Json | null
          objective?: string | null
          restrictions?: Json
          training_day_bonus?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_level?: string
          allergens?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          manual_calories?: number | null
          manual_carbs_g?: number | null
          manual_fat_g?: number | null
          manual_protein_g?: number | null
          meals?: Json | null
          objective?: string | null
          restrictions?: Json
          training_day_bonus?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string
          created_at: string
          deleted_at: string | null
          exercise_id: string
          id: string
          reps: number | null
          type: string
          updated_at: string
          user_id: string
          value: number
          weight_kg: number | null
          workout_id: string | null
        }
        Insert: {
          achieved_at: string
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          id: string
          reps?: number | null
          type: string
          updated_at?: string
          user_id: string
          value: number
          weight_kg?: number | null
          workout_id?: string | null
        }
        Update: {
          achieved_at?: string
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          id?: string
          reps?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          value?: number
          weight_kg?: number | null
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          owner_id: string
          program_id: string
          scheduled_date: string
          session_id: string
          status: string
          updated_at: string
          week_index: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id: string
          owner_id: string
          program_id: string
          scheduled_date: string
          session_id: string
          status?: string
          updated_at?: string
          week_index?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_id?: string
          program_id?: string
          scheduled_date?: string
          session_id?: string
          status?: string
          updated_at?: string
          week_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          first_name: string | null
          height_cm: number | null
          id: string
          main_goal: string | null
          onboarding_completed_at: string | null
          sex: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          height_cm?: number | null
          id: string
          main_goal?: string | null
          onboarding_completed_at?: string | null
          sex?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          height_cm?: number | null
          id?: string
          main_goal?: string | null
          onboarding_completed_at?: string | null
          sex?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      program_translations: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          lang: string
          name: string
          owner_id: string | null
          program_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id: string
          lang: string
          name: string
          owner_id?: string | null
          program_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          lang?: string
          name?: string
          owner_id?: string | null
          program_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_translations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_weeks: number | null
          goal: string | null
          id: string
          is_active: boolean
          level: string | null
          owner_id: string | null
          pillar: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id: string
          is_active?: boolean
          level?: string | null
          owner_id?: string | null
          pillar: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          owner_id?: string | null
          pillar?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          carbs_g: number
          created_at: string
          deleted_at: string | null
          fat_g: number
          food_id: string | null
          id: string
          kcal: number
          name: string
          protein_g: number
          quantity_g: number | null
          recipe_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          deleted_at?: string | null
          fat_g?: number
          food_id?: string | null
          id: string
          kcal?: number
          name: string
          protein_g?: number
          quantity_g?: number | null
          recipe_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          deleted_at?: string | null
          fat_g?: number
          food_id?: string | null
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
          quantity_g?: number | null
          recipe_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          servings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          name: string
          servings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          servings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      running_pace_records: {
        Row: {
          achieved_at: string
          best_time_seconds: number
          created_at: string
          deleted_at: string | null
          distance_key: string
          id: string
          run_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at: string
          best_time_seconds: number
          created_at?: string
          deleted_at?: string | null
          distance_key: string
          id: string
          run_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          best_time_seconds?: number
          created_at?: string
          deleted_at?: string | null
          distance_key?: string
          id?: string
          run_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_pace_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      running_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          level: string | null
          objective: string | null
          ref_5k_pace_s_per_km: number | null
          updated_at: string
          user_id: string
          weekly_frequency: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          level?: string | null
          objective?: string | null
          ref_5k_pace_s_per_km?: number | null
          updated_at?: string
          user_id: string
          weekly_frequency?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: string | null
          objective?: string | null
          ref_5k_pace_s_per_km?: number | null
          updated_at?: string
          user_id?: string
          weekly_frequency?: number | null
        }
        Relationships: []
      }
      runs: {
        Row: {
          avg_pace_s_per_km: number | null
          created_at: string
          deleted_at: string | null
          distance_m: number | null
          duration_seconds: number | null
          finished_at: string | null
          gps_track: string | null
          id: string
          notes: string | null
          rpe: number | null
          source: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_pace_s_per_km?: number | null
          created_at?: string
          deleted_at?: string | null
          distance_m?: number | null
          duration_seconds?: number | null
          finished_at?: string | null
          gps_track?: string | null
          id: string
          notes?: string | null
          rpe?: number | null
          source?: string
          started_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_pace_s_per_km?: number | null
          created_at?: string
          deleted_at?: string | null
          distance_m?: number | null
          duration_seconds?: number | null
          finished_at?: string | null
          gps_track?: string | null
          id?: string
          notes?: string | null
          rpe?: number | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string | null
          order_index: number
          owner_id: string | null
          program_id: string
          session_type: string | null
          target_distance_m: number | null
          target_duration_seconds: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          name?: string | null
          order_index?: number
          owner_id?: string | null
          program_id: string
          session_type?: string | null
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string | null
          order_index?: number
          owner_id?: string | null
          program_id?: string
          session_type?: string | null
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          created_at: string
          id: string
          text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          text?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_pillars: Json
          created_at: string
          dashboard_layout: Json | null
          deleted_at: string | null
          id: string
          language: string
          notifications: Json
          theme: string
          units: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_pillars?: Json
          created_at?: string
          dashboard_layout?: Json | null
          deleted_at?: string | null
          id: string
          language?: string
          notifications?: Json
          theme?: string
          units?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_pillars?: Json
          created_at?: string
          dashboard_layout?: Json | null
          deleted_at?: string | null
          id?: string
          language?: string
          notifications?: Json
          theme?: string
          units?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          created_at: string
          deleted_at: string | null
          done: boolean
          duration_seconds: number | null
          exercise_id: string
          id: string
          order_index: number
          reps: number | null
          set_type: string
          updated_at: string
          user_id: string
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          done?: boolean
          duration_seconds?: number | null
          exercise_id: string
          id: string
          order_index?: number
          reps?: number | null
          set_type?: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          done?: boolean
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          order_index?: number
          reps?: number | null
          set_type?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          finished_at: string | null
          id: string
          notes: string | null
          program_id: string | null
          rpe: number | null
          session_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          finished_at?: string | null
          id: string
          notes?: string | null
          program_id?: string | null
          rpe?: number | null
          session_id?: string | null
          started_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          rpe?: number | null
          session_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_content_editor: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
